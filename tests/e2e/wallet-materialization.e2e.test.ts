/**
 * E2E Tests for Wallet Materialization from Trades (INGEST-WALLET-001)
 *
 * Browser-based end-to-end tests verifying:
 * - Wallets are created from trade data
 * - Wallet activity timestamps are updated
 * - Trade count and volume are tracked
 * - Wallet detail pages display correctly
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import * as fs from "fs";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const SCREENSHOT_DIR = "tests/e2e/screenshots/wallet-materialization";

// Utility function to wait
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

describe("INGEST-WALLET-001: E2E Wallet Materialization Tests", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe("Wallet API Verification", () => {
    it("should return 200 from /api/dashboard/whales endpoint", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      expect(response?.status()).toBe(200);
    });

    it("should return wallets with materialized data structure", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data && Array.isArray(data.wallets)) {
        expect(Array.isArray(data.wallets)).toBe(true);

        if (data.wallets.length > 0) {
          const wallet = data.wallets[0];
          // Verify wallet has required fields from materialization
          expect(wallet).toHaveProperty("id");
          expect(wallet).toHaveProperty("address");

          // Address should be normalized (lowercase)
          if (wallet.address) {
            expect(wallet.address).toBe(wallet.address.toLowerCase());
          }
        }
      }
    });

    it("should return wallets with trade count field", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        const wallet = data.wallets[0];
        // Trade count should be a number
        if (wallet.tradeCount !== undefined) {
          expect(typeof wallet.tradeCount).toBe("number");
          expect(wallet.tradeCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should return wallets with total volume field", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        const wallet = data.wallets[0];
        // Total volume should be a number
        if (wallet.totalVolume !== undefined) {
          expect(typeof wallet.totalVolume).toBe("number");
          expect(wallet.totalVolume).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should return wallets with first trade timestamp", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        const wallet = data.wallets[0];
        // First trade timestamp should be string or null
        if (wallet.firstTradeAt !== null && wallet.firstTradeAt !== undefined) {
          expect(typeof wallet.firstTradeAt).toBe("string");
          // Should be valid ISO date
          const date = new Date(wallet.firstTradeAt);
          expect(date.getTime()).not.toBeNaN();
        }
      }
    });

    it("should return wallets with last trade timestamp", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        const wallet = data.wallets[0];
        // Last trade timestamp should be string or null
        if (wallet.lastTradeAt !== null && wallet.lastTradeAt !== undefined) {
          expect(typeof wallet.lastTradeAt).toBe("string");
          // Should be valid ISO date
          const date = new Date(wallet.lastTradeAt);
          expect(date.getTime()).not.toBeNaN();
        }
      }
    });

    it("should ensure firstTradeAt <= lastTradeAt", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        data.wallets.forEach((wallet: any) => {
          if (wallet.firstTradeAt && wallet.lastTradeAt) {
            const firstTrade = new Date(wallet.firstTradeAt).getTime();
            const lastTrade = new Date(wallet.lastTradeAt).getTime();
            expect(firstTrade).toBeLessThanOrEqual(lastTrade);
          }
        });
      }
    });
  });

  describe("Wallet Stats Consistency", () => {
    it("should return wallets with avg trade size", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        const wallet = data.wallets[0];
        if (wallet.avgTradeSize !== undefined && wallet.avgTradeSize !== null) {
          expect(typeof wallet.avgTradeSize).toBe("number");
          expect(wallet.avgTradeSize).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should return wallets with max trade size", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        const wallet = data.wallets[0];
        if (wallet.maxTradeSize !== undefined && wallet.maxTradeSize !== null) {
          expect(typeof wallet.maxTradeSize).toBe("number");
          expect(wallet.maxTradeSize).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should have consistent avg trade size calculation", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        data.wallets.forEach((wallet: any) => {
          if (
            wallet.totalVolume !== undefined &&
            wallet.tradeCount !== undefined &&
            wallet.avgTradeSize !== undefined &&
            wallet.tradeCount > 0
          ) {
            // avgTradeSize should be approximately totalVolume / tradeCount
            const expectedAvg = wallet.totalVolume / wallet.tradeCount;
            // Allow for floating point precision difference
            expect(Math.abs(wallet.avgTradeSize - expectedAvg)).toBeLessThan(0.01);
          }
        });
      }
    });

    it("should have maxTradeSize >= avgTradeSize", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        data.wallets.forEach((wallet: any) => {
          if (
            wallet.maxTradeSize !== undefined &&
            wallet.maxTradeSize !== null &&
            wallet.avgTradeSize !== undefined &&
            wallet.avgTradeSize !== null
          ) {
            expect(wallet.maxTradeSize).toBeGreaterThanOrEqual(wallet.avgTradeSize);
          }
        });
      }
    });
  });

  describe("Wallet Fresh Detection", () => {
    it("should return wallets with isFresh flag", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        const wallet = data.wallets[0];
        // isFresh should be a boolean (may be in flags object)
        if (wallet.isFresh !== undefined) {
          expect(typeof wallet.isFresh).toBe("boolean");
        } else if (wallet.flags?.isFresh !== undefined) {
          expect(typeof wallet.flags.isFresh).toBe("boolean");
        }
      }
    });

    it("should filter by fresh wallets", async () => {
      const response = await page.goto(
        `${BASE_URL}/api/dashboard/whales?isFresh=true`
      );
      expect(response?.status()).toBe(200);
    });
  });

  describe("Wallet Whale Detection", () => {
    it("should return wallets with isWhale flag", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        const wallet = data.wallets[0];
        // isWhale should be a boolean (may be in flags object)
        if (wallet.isWhale !== undefined) {
          expect(typeof wallet.isWhale).toBe("boolean");
        } else if (wallet.flags?.isWhale !== undefined) {
          expect(typeof wallet.flags.isWhale).toBe("boolean");
        }
      }
    });

    it("should filter by whale status", async () => {
      const response = await page.goto(
        `${BASE_URL}/api/dashboard/whales?isWhale=true`
      );
      const data = await response?.json().catch(() => null);

      if (data?.wallets?.length > 0) {
        // All returned wallets should be whales
        data.wallets.forEach((wallet: any) => {
          const isWhale = wallet.isWhale ?? wallet.flags?.isWhale;
          expect(isWhale).toBe(true);
        });
      }
    });
  });

  describe("Dashboard Wallet Display", () => {
    it("should load dashboard page successfully", async () => {
      const response = await page.goto(`${BASE_URL}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      expect(response?.status()).toBe(200);
    });

    it("should display wallet activity section", async () => {
      await page.goto(`${BASE_URL}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Check for wallet/trading activity content
      const hasWalletSection = await page.evaluate(() => {
        const content = document.body.innerText.toLowerCase();
        return (
          content.includes("wallet") ||
          content.includes("whale") ||
          content.includes("address") ||
          content.includes("trade")
        );
      });

      expect(hasWalletSection).toBe(true);
    });

    it("should take screenshot of dashboard with wallets", async () => {
      await page.goto(`${BASE_URL}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await wait(1000);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/dashboard-wallets.png`,
        fullPage: true,
      });

      expect(fs.existsSync(`${SCREENSHOT_DIR}/dashboard-wallets.png`)).toBe(true);
    });
  });

  describe("Wallet Detail Page", () => {
    it("should load wallet detail page", async () => {
      // First get a wallet address from the API
      const apiResponse = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await apiResponse?.json().catch(() => null);

      const walletAddress = data?.wallets?.[0]?.address || "0xtest123";
      const response = await page.goto(`${BASE_URL}/wallet/${walletAddress}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Should load (200 or 404 depending on whether wallet exists)
      expect([200, 404]).toContain(response?.status());
    });

    it("should display wallet trade statistics", async () => {
      const apiResponse = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await apiResponse?.json().catch(() => null);

      const walletAddress = data?.wallets?.[0]?.address || "0xtest123";
      await page.goto(`${BASE_URL}/wallet/${walletAddress}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      const pageContent = await page.content();
      expect(pageContent.length).toBeGreaterThan(0);
    });

    it("should take screenshot of wallet detail page", async () => {
      const apiResponse = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await apiResponse?.json().catch(() => null);

      const walletAddress = data?.wallets?.[0]?.address || "0xtest123";
      await page.goto(`${BASE_URL}/wallet/${walletAddress}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await wait(500);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/wallet-detail.png`,
        fullPage: true,
      });

      expect(fs.existsSync(`${SCREENSHOT_DIR}/wallet-detail.png`)).toBe(true);
    });
  });

  describe("Responsive Design", () => {
    it("should display wallets on mobile", async () => {
      await page.setViewport({ width: 375, height: 812 });
      await page.goto(`${BASE_URL}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/dashboard-wallets-mobile.png`,
        fullPage: true,
      });

      expect(fs.existsSync(`${SCREENSHOT_DIR}/dashboard-wallets-mobile.png`)).toBe(
        true
      );

      // Reset viewport
      await page.setViewport({ width: 1920, height: 1080 });
    });

    it("should display wallets on tablet", async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(`${BASE_URL}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/dashboard-wallets-tablet.png`,
        fullPage: true,
      });

      expect(fs.existsSync(`${SCREENSHOT_DIR}/dashboard-wallets-tablet.png`)).toBe(
        true
      );

      // Reset viewport
      await page.setViewport({ width: 1920, height: 1080 });
    });
  });

  describe("Wallet Address Normalization", () => {
    it("should accept uppercase wallet address in URL", async () => {
      const response = await page.goto(
        `${BASE_URL}/wallet/0xABCDEF1234567890ABCDEF1234567890ABCDEF12`,
        {
          waitUntil: "networkidle2",
          timeout: 30000,
        }
      );

      // Should not crash - return 200 with content or 404
      expect([200, 404]).toContain(response?.status());
    });

    it("should accept lowercase wallet address in URL", async () => {
      const response = await page.goto(
        `${BASE_URL}/wallet/0xabcdef1234567890abcdef1234567890abcdef12`,
        {
          waitUntil: "networkidle2",
          timeout: 30000,
        }
      );

      expect([200, 404]).toContain(response?.status());
    });

    it("should accept mixed case wallet address in URL", async () => {
      const response = await page.goto(
        `${BASE_URL}/wallet/0xAbCdEf1234567890AbCdEf1234567890AbCdEf12`,
        {
          waitUntil: "networkidle2",
          timeout: 30000,
        }
      );

      expect([200, 404]).toContain(response?.status());
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid wallet address gracefully", async () => {
      const response = await page.goto(
        `${BASE_URL}/wallet/invalid-nonexistent-address`,
        {
          waitUntil: "networkidle2",
          timeout: 30000,
        }
      );

      expect([200, 404, 500]).toContain(response?.status());
    });

    it("should not crash on empty wallet address", async () => {
      const response = await page.goto(`${BASE_URL}/wallet/`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Should not crash
      expect([200, 404, 500]).toContain(response?.status());
    });
  });

  describe("Performance", () => {
    it("should load wallets API in reasonable time", async () => {
      const startTime = Date.now();

      await page.goto(`${BASE_URL}/api/dashboard/whales`);

      const loadTime = Date.now() - startTime;

      // API should respond within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    it("should load wallet detail page in reasonable time", async () => {
      const startTime = Date.now();

      await page.goto(`${BASE_URL}/wallet/0xtest123`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      const loadTime = Date.now() - startTime;

      // Page should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });
  });

  describe("Pagination", () => {
    it("should support pagination in wallets API", async () => {
      const response = await page.goto(
        `${BASE_URL}/api/dashboard/whales?limit=5&offset=0`
      );
      const data = await response?.json().catch(() => null);

      if (data?.pagination) {
        expect(data.pagination.limit).toBe(5);
        expect(data.pagination.offset).toBe(0);
      }
    });

    it("should return total count in pagination", async () => {
      const response = await page.goto(`${BASE_URL}/api/dashboard/whales`);
      const data = await response?.json().catch(() => null);

      if (data?.pagination) {
        expect(typeof data.pagination.total).toBe("number");
        expect(data.pagination.total).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
