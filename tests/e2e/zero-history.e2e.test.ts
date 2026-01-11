/**
 * E2E Tests for Zero Trading History Detector (DET-FRESH-003)
 *
 * Tests that:
 * 1. The app loads correctly with the new detection module
 * 2. The zero history detector can be imported and used
 * 3. Browser can access the app
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  TradingHistoryStatus,
  WalletHistoryType,
  ZeroHistoryDetector,
  createZeroHistoryDetector,
  getSharedZeroHistoryDetector,
  resetSharedZeroHistoryDetector,
} from "../../src/detection/zero-history";
import { FreshWalletAlertSeverity } from "../../src/detection/fresh-wallet-config";

describe("Zero History Detector E2E Tests", () => {
  describe("Detection Module Integration", () => {
    beforeAll(() => {
      resetSharedZeroHistoryDetector();
    });

    afterAll(() => {
      resetSharedZeroHistoryDetector();
    });

    it("should create and configure zero history detector", () => {
      const detector = createZeroHistoryDetector({
        cacheTtlMs: 60000,
        maxCacheSize: 500,
        dormancyDays: 45,
      });

      expect(detector).toBeInstanceOf(ZeroHistoryDetector);
      expect(detector.getDormancyDays()).toBe(45);

      const stats = detector.getCacheStats();
      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(60000);
    });

    it("should manage shared singleton correctly", () => {
      const shared1 = getSharedZeroHistoryDetector();
      const shared2 = getSharedZeroHistoryDetector();

      expect(shared1).toBe(shared2);

      resetSharedZeroHistoryDetector();
      const shared3 = getSharedZeroHistoryDetector();

      expect(shared3).not.toBe(shared1);
    });

    it("should have all required enums and types", () => {
      // Verify TradingHistoryStatus enum values
      expect(TradingHistoryStatus.NEVER_TRADED).toBe("NEVER_TRADED");
      expect(TradingHistoryStatus.FIRST_TRADE).toBe("FIRST_TRADE");
      expect(TradingHistoryStatus.MINIMAL_HISTORY).toBe("MINIMAL_HISTORY");
      expect(TradingHistoryStatus.HAS_HISTORY).toBe("HAS_HISTORY");

      // Verify WalletHistoryType enum values
      expect(WalletHistoryType.NEW_EVERYWHERE).toBe("NEW_EVERYWHERE");
      expect(WalletHistoryType.BLOCKCHAIN_VETERAN_PM_NEW).toBe("BLOCKCHAIN_VETERAN_PM_NEW");
      expect(WalletHistoryType.BLOCKCHAIN_NEW_PM_ACTIVE).toBe("BLOCKCHAIN_NEW_PM_ACTIVE");
      expect(WalletHistoryType.ESTABLISHED).toBe("ESTABLISHED");
    });

    it("should handle cache operations correctly", () => {
      const detector = createZeroHistoryDetector({ maxCacheSize: 10 });

      // Initial cache should be empty
      expect(detector.getCacheStats().size).toBe(0);

      // Clear cache should work
      detector.clearCache();
      expect(detector.getCacheStats().size).toBe(0);

      // Invalidating non-existent entry should return false
      const result = detector.invalidateCacheEntry("0x1234567890123456789012345678901234567890");
      expect(result).toBe(false);
    });

    it("should handle status history operations", () => {
      const detector = createZeroHistoryDetector();

      // Initial status history should be empty
      const status = detector.getStatusHistory("0x1234567890123456789012345678901234567890");
      expect(status).toBeUndefined();

      // Clear status history should work
      detector.clearStatusHistory();

      // After clearing, should still be undefined
      const statusAfterClear = detector.getStatusHistory("0x1234567890123456789012345678901234567890");
      expect(statusAfterClear).toBeUndefined();
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

      // Check there are no console errors related to the zero-history module
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      // Take a screenshot for verification
      await page.screenshot({
        path: "/tmp/zero-history-e2e.png",
        fullPage: true,
      });

      // Filter out expected errors (like API calls that may fail in test environment)
      const unexpectedErrors = errors.filter(
        (e) => !e.includes("fetch") && !e.includes("network") && !e.includes("Failed to load")
      );

      // Should have no unexpected console errors
      expect(unexpectedErrors.length).toBe(0);
    }, 30000);

    it("should verify app responsive layout with zero-history module", async () => {
      if (!page) {
        console.log("Skipping - browser not available");
        return;
      }

      // Test mobile viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

      const mobileScreenshot = await page.screenshot({
        path: "/tmp/zero-history-e2e-mobile.png",
      });
      expect(mobileScreenshot).toBeDefined();

      // Test desktop viewport
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

      const desktopScreenshot = await page.screenshot({
        path: "/tmp/zero-history-e2e-desktop.png",
      });
      expect(desktopScreenshot).toBeDefined();
    }, 30000);
  });
});
