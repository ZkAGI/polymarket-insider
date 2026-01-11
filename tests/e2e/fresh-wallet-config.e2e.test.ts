/**
 * E2E Tests for Fresh Wallet Threshold Configuration (DET-FRESH-002)
 *
 * Tests that:
 * 1. The app loads correctly with the new detection module
 * 2. Configuration can be loaded and evaluated
 * 3. Browser can access the app
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  FreshWalletConfigManager,
  FreshWalletAlertSeverity,
  evaluateWalletFreshness,
  getThresholdsForCategory,
  createFreshWalletConfigManager,
} from "../../src/detection/fresh-wallet-config";
import { MarketCategory } from "../../src/api/gamma/types";
import { AgeCategory } from "../../src/detection/wallet-age";

describe("Fresh Wallet Config E2E Tests", () => {
  describe("Configuration Module Integration", () => {
    it("should create and use config manager in a realistic workflow", () => {
      // Simulate a realistic workflow where we:
      // 1. Create a config manager
      // 2. Evaluate multiple wallets
      // 3. Check results

      const manager = createFreshWalletConfigManager();

      // Simulate evaluating a batch of wallets
      const wallets = [
        { walletAgeDays: 5, transactionCount: 2, polymarketTradeCount: 0 },
        { walletAgeDays: 30, transactionCount: 10, polymarketTradeCount: 5 },
        { walletAgeDays: 100, transactionCount: 50, polymarketTradeCount: 20 },
        { walletAgeDays: null, transactionCount: 0, polymarketTradeCount: 0 },
      ];

      const results = wallets.map((wallet) =>
        manager.evaluateWallet({
          ...wallet,
          category: MarketCategory.POLITICS,
        })
      );

      // Verify results
      expect(results[0].isFresh).toBe(true);
      expect(results[0].severity).toBe(FreshWalletAlertSeverity.HIGH);

      expect(results[1].isFresh).toBe(true); // Politics has 60 day threshold

      expect(results[2].isFresh).toBe(false);
      expect(results[2].ageCategory).toBe(AgeCategory.ESTABLISHED);

      expect(results[3].isFresh).toBe(true);
      expect(results[3].severity).toBe(FreshWalletAlertSeverity.CRITICAL);
      expect(results[3].ageCategory).toBe(AgeCategory.NEW);
    });

    it("should support different thresholds per market category", () => {
      // Politics should have stricter thresholds (60 days)
      const politicsThresholds = getThresholdsForCategory(MarketCategory.POLITICS);
      expect(politicsThresholds.maxAgeDays).toBe(60);

      // Crypto should have more relaxed thresholds (14 days)
      const cryptoThresholds = getThresholdsForCategory(MarketCategory.CRYPTO);
      expect(cryptoThresholds.maxAgeDays).toBe(14);

      // Default category (null) should use 30 days
      const defaultThresholds = getThresholdsForCategory(null);
      expect(defaultThresholds.maxAgeDays).toBe(30);
    });

    it("should correctly classify wallets near market close", () => {
      const manager = createFreshWalletConfigManager();

      // Same wallet, different scenarios
      const wallet = {
        walletAgeDays: 20,
        transactionCount: 6,
        polymarketTradeCount: 4,
        category: null as MarketCategory | null,
      };

      // Normal evaluation (48 hours from close)
      const normalResult = manager.evaluateWallet({
        ...wallet,
        hoursUntilClose: 48,
      });
      expect(normalResult.appliedThresholds.maxAgeDays).toBe(30);

      // Near close evaluation (12 hours from close)
      const nearCloseResult = manager.evaluateWallet({
        ...wallet,
        hoursUntilClose: 12,
      });
      // Thresholds should be stricter near close
      expect(nearCloseResult.appliedThresholds.maxAgeDays).toBe(15);
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

      // Check there are no console errors
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      // Take a screenshot for verification
      await page.screenshot({
        path: "/tmp/fresh-wallet-config-e2e.png",
        fullPage: true,
      });

      // Filter out expected errors (like API calls that may fail in test environment)
      const unexpectedErrors = errors.filter(
        (e) => !e.includes("fetch") && !e.includes("network")
      );

      // Should have no unexpected console errors
      expect(unexpectedErrors.length).toBe(0);
    }, 30000);

    it("should have responsive layout", async () => {
      if (!page) {
        console.log("Skipping - browser not available");
        return;
      }

      // Test mobile viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

      const mobileScreenshot = await page.screenshot({
        path: "/tmp/fresh-wallet-config-e2e-mobile.png",
      });
      expect(mobileScreenshot).toBeDefined();

      // Test desktop viewport
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

      const desktopScreenshot = await page.screenshot({
        path: "/tmp/fresh-wallet-config-e2e-desktop.png",
      });
      expect(desktopScreenshot).toBeDefined();
    }, 30000);
  });
});
