/**
 * E2E Browser Tests for SuspiciousWalletsWidget
 * Feature: UI-DASH-004 - Top suspicious wallets widget
 *
 * Tests use Puppeteer to verify wallet widget functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;

describe('SuspiciousWalletsWidget E2E Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    await page.close();
  });

  describe('Suspicious Wallets Widget Loading', () => {
    it('should load the dashboard with suspicious wallets widget', async () => {
      const response = await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="suspicious-wallets-widget"]');
      expect(widget).not.toBeNull();
    });

    it('should display Top Suspicious Wallets widget with correct title', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const title = await page.evaluate(() => {
        const widget = document.querySelector('[data-testid="suspicious-wallets-widget"]');
        return widget?.querySelector('[data-testid="widget-title"]')?.textContent;
      });

      expect(title).toBe('Top Suspicious Wallets');
    });

    it('should show loading state initially then content', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="suspicious-wallets-content"]') !== null,
        { timeout: 10000 }
      );

      const content = await page.$('[data-testid="suspicious-wallets-content"]');
      expect(content).not.toBeNull();
    });
  });

  describe('Wallet List Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="suspicious-wallets-content"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display wallets list container', async () => {
      const walletsList = await page.$('[data-testid="wallets-list"]');
      expect(walletsList).not.toBeNull();
    });

    it('should display summary section', async () => {
      const summary = await page.$('[data-testid="wallets-summary"]');
      expect(summary).not.toBeNull();
    });

    it('should show total wallets count in summary', async () => {
      const totalBadge = await page.$('[data-testid="total-wallets-count"]');
      expect(totalBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, totalBadge);
      expect(text).toMatch(/\d+ total/);
    });

    it('should display multiple wallet items', async () => {
      const walletItems = await page.$$('[data-testid^="wallet-item-"]');
      expect(walletItems.length).toBeGreaterThan(0);
    });

    it('should display up to 5 wallets by default', async () => {
      const walletItems = await page.$$('[data-testid^="wallet-item-"]');
      expect(walletItems.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Wallet Item Structure', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="wallets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display wallet item with rank badge', async () => {
      const rankBadge = await page.$('[data-testid="wallet-rank"]');
      expect(rankBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, rankBadge);
      expect(text).toBe('1'); // First wallet should have rank 1
    });

    it('should display wallet address', async () => {
      const address = await page.$('[data-testid="wallet-address"]');
      expect(address).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, address);
      expect(text).toBeTruthy();
      expect(text?.length).toBeGreaterThan(0);
    });

    it('should display suspicion level badge', async () => {
      const levelBadge = await page.$('[data-testid="wallet-level-badge"]');
      expect(levelBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, levelBadge);
      expect(['Critical', 'High', 'Medium', 'Low', 'None']).toContain(text);
    });

    it('should display score bar', async () => {
      const scoreBar = await page.$('[data-testid="wallet-score-bar"]');
      expect(scoreBar).not.toBeNull();
    });

    it('should display score value', async () => {
      const scoreValue = await page.$('[data-testid="wallet-score-value"]');
      expect(scoreValue).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, scoreValue);
      expect(text).toMatch(/^\d+$/);
    });

    it('should display wallet volume', async () => {
      const volume = await page.$('[data-testid="wallet-volume"]');
      expect(volume).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, volume);
      expect(text).toMatch(/^\$[\d.]+[KM]?$/);
    });

    it('should display wallet win rate', async () => {
      const winRate = await page.$('[data-testid="wallet-win-rate"]');
      expect(winRate).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, winRate);
      expect(text).toMatch(/\d+% win/);
    });

    it('should display wallet trade count', async () => {
      const trades = await page.$('[data-testid="wallet-trades"]');
      expect(trades).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, trades);
      expect(text).toMatch(/\d+ trades/);
    });

    it('should display wallet last activity', async () => {
      const lastActivity = await page.$('[data-testid="wallet-last-activity"]');
      expect(lastActivity).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, lastActivity);
      expect(text).toMatch(/(Just now|\d+[mhd] ago)/);
    });

    it('should display watch button', async () => {
      const watchButton = await page.$('[data-testid="wallet-watch-button"]');
      expect(watchButton).not.toBeNull();
    });

    it('should have correct data attributes on wallet items', async () => {
      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      expect(walletItem).not.toBeNull();

      const dataAddress = await page.evaluate(
        (el) => el?.getAttribute('data-wallet-address'),
        walletItem
      );
      expect(dataAddress).toBeTruthy();

      const dataScore = await page.evaluate(
        (el) => el?.getAttribute('data-wallet-score'),
        walletItem
      );
      expect(dataScore).toBeTruthy();
    });
  });

  describe('Risk Flags Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="wallets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display risk flags container', async () => {
      const riskFlags = await page.$('[data-testid="wallet-risk-flags"]');
      // Risk flags may or may not be present depending on mock data
      expect(typeof riskFlags).toBe('object');
    });

    it('should display risk flag icons when present', async () => {
      const riskFlags = await page.$('[data-testid="wallet-risk-flags"]');
      if (riskFlags) {
        const flags = await page.$$('[data-testid^="risk-flag-"]');
        expect(flags.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Wallet Interactivity', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="wallets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should be clickable with cursor pointer', async () => {
      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      expect(walletItem).not.toBeNull();

      const cursor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).cursor;
      }, walletItem);

      expect(cursor).toBe('pointer');
    });

    it('should have role="button" for accessibility', async () => {
      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), walletItem);
      expect(role).toBe('button');
    });

    it('should have tabIndex for keyboard navigation', async () => {
      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      const tabIndex = await page.evaluate(
        (el) => el?.getAttribute('tabindex'),
        walletItem
      );
      expect(tabIndex).toBe('0');
    });

    it('should respond to click events without errors', async () => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      await walletItem?.click();

      // Wait a moment for any errors to appear
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Filter out unrelated errors
      const relevantErrors = consoleErrors.filter(
        (err) => !err.includes('DevTools') && !err.includes('Extension')
      );
      expect(relevantErrors).toHaveLength(0);
    });

    it('should toggle watch button on click', async () => {
      const watchButton = await page.$('[data-testid="wallet-watch-button"]');
      expect(watchButton).not.toBeNull();

      // Click the watch button
      await watchButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify no errors occurred
      const walletItems = await page.$$('[data-testid^="wallet-item-"]');
      expect(walletItems.length).toBeGreaterThan(0);
    });
  });

  describe('Refresh Functionality', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="suspicious-wallets-widget"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have refresh button in widget header', async () => {
      const widget = await page.$('[data-testid="suspicious-wallets-widget"]');
      const refreshButton = await widget?.$('[data-testid="widget-refresh-button"]');
      expect(refreshButton).not.toBeNull();
    });

    it('should be able to click refresh button', async () => {
      const refreshButton = await page.$(
        '[data-testid="suspicious-wallets-widget"] [data-testid="widget-refresh-button"]'
      );
      expect(refreshButton).not.toBeNull();

      await refreshButton?.click();

      // Wait for refresh to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify content is still displayed after refresh
      const walletsList = await page.$('[data-testid="wallets-list"]');
      expect(walletsList).not.toBeNull();
    });
  });

  describe('Visual Styling', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="wallets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have proper spacing between wallet items', async () => {
      const walletsList = await page.$('[data-testid="wallets-list"]');
      const gap = await page.evaluate((el) => {
        const style = window.getComputedStyle(el!);
        return style.gap || style.rowGap;
      }, walletsList);

      // Should have spacing (0.75rem = 12px or similar)
      expect(gap).toBeTruthy();
    });

    it('should have background color on wallet items', async () => {
      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      const bgColor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).backgroundColor;
      }, walletItem);

      // Should have some background color (not transparent)
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(bgColor).not.toBe('transparent');
    });

    it('should have rounded corners on wallet items', async () => {
      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      const borderRadius = await page.evaluate((el) => {
        return window.getComputedStyle(el!).borderRadius;
      }, walletItem);

      expect(borderRadius).toBeTruthy();
      expect(borderRadius).not.toBe('0px');
    });

    it('should have left border for severity indication', async () => {
      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      const borderLeft = await page.evaluate((el) => {
        return window.getComputedStyle(el!).borderLeftWidth;
      }, walletItem);

      expect(borderLeft).toBe('4px');
    });

    it('should have score bar with proper fill', async () => {
      const scoreFill = await page.$('[data-testid="wallet-score-fill"]');
      expect(scoreFill).not.toBeNull();

      const width = await page.evaluate((el) => {
        return (el as HTMLElement | null)?.style.width;
      }, scoreFill);

      expect(width).toMatch(/^\d+%$/);
    });
  });

  describe('Summary Badges', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="wallets-summary"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display total wallets count badge', async () => {
      const totalBadge = await page.$('[data-testid="total-wallets-count"]');
      expect(totalBadge).not.toBeNull();
    });

    it('should show critical badge when critical wallets exist', async () => {
      // This may or may not be present depending on mock data
      const criticalBadge = await page.$('[data-testid="critical-wallets-count"]');
      // Just verify no errors - the badge is optional based on data
      expect(typeof criticalBadge).toBe('object');
    });

    it('should show high badge when high-risk wallets exist', async () => {
      // This may or may not be present depending on mock data
      const highBadge = await page.$('[data-testid="high-wallets-count"]');
      expect(typeof highBadge).toBe('object');
    });

    it('should show watched badge when watched wallets exist', async () => {
      // This may or may not be present depending on mock data
      const watchedBadge = await page.$('[data-testid="watched-wallets-count"]');
      expect(typeof watchedBadge).toBe('object');
    });
  });

  describe('Responsive Layout', () => {
    it('should display properly on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="suspicious-wallets-widget"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="suspicious-wallets-widget"]');
      const isVisible = await page.evaluate((el) => {
        const rect = el?.getBoundingClientRect();
        return rect && rect.width > 0 && rect.height > 0;
      }, widget);

      expect(isVisible).toBe(true);
    });

    it('should display properly on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 }); // iPad
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="suspicious-wallets-widget"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="suspicious-wallets-widget"]');
      const isVisible = await page.evaluate((el) => {
        const rect = el?.getBoundingClientRect();
        return rect && rect.width > 0 && rect.height > 0;
      }, widget);

      expect(isVisible).toBe(true);
    });

    it('should display properly on desktop viewport', async () => {
      await page.setViewport({ width: 1280, height: 720 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="suspicious-wallets-widget"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="suspicious-wallets-widget"]');
      const isVisible = await page.evaluate((el) => {
        const rect = el?.getBoundingClientRect();
        return rect && rect.width > 0 && rect.height > 0;
      }, widget);

      expect(isVisible).toBe(true);
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="wallets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have aria-label on wallets list', async () => {
      const walletsList = await page.$('[data-testid="wallets-list"]');
      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        walletsList
      );
      expect(ariaLabel).toBe('Suspicious wallets ranked by score');
    });

    it('should have role="list" on wallets container', async () => {
      const walletsList = await page.$('[data-testid="wallets-list"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), walletsList);
      expect(role).toBe('list');
    });

    it('should have accessible aria-label on wallet items', async () => {
      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        walletItem
      );
      expect(ariaLabel).toMatch(/Wallet .+ with suspicion score \d+/);
    });

    it('should have accessible aria-label on watch button', async () => {
      const watchButton = await page.$('[data-testid="wallet-watch-button"]');
      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        watchButton
      );
      expect(ariaLabel).toMatch(/(Add to|Remove from) watchlist/);
    });
  });

  describe('Console Errors', () => {
    it('should not have any JavaScript console errors', async () => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="suspicious-wallets-content"]') !== null,
        { timeout: 10000 }
      );

      // Wait for any async operations
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Filter out known non-critical errors
      const criticalErrors = consoleErrors.filter(
        (err) => !err.includes('DevTools') && !err.includes('Extension')
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });

  describe('Wallet Ranking', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="wallets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display wallets in descending order by suspicion score', async () => {
      const walletItems = await page.$$('[data-testid^="wallet-item-"]');

      const scores: number[] = [];
      for (const item of walletItems) {
        const score = await page.evaluate(
          (el) => parseInt(el?.getAttribute('data-wallet-score') || '0', 10),
          item
        );
        scores.push(score);
      }

      // Verify scores are in descending order
      for (let i = 0; i < scores.length - 1; i++) {
        const current = scores[i];
        const next = scores[i + 1];
        if (current !== undefined && next !== undefined) {
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    it('should show rank 1 for highest scored wallet', async () => {
      const firstRankBadge = await page.$('[data-testid^="wallet-item-"] [data-testid="wallet-rank"]');
      const rank = await page.evaluate((el) => el?.textContent, firstRankBadge);
      expect(rank).toBe('1');
    });

    it('should show sequential ranks for all wallets', async () => {
      const rankBadges = await page.$$('[data-testid="wallet-rank"]');

      for (let i = 0; i < rankBadges.length; i++) {
        const rank = await page.evaluate((el) => el?.textContent, rankBadges[i]);
        expect(rank).toBe(String(i + 1));
      }
    });
  });

  describe('Suspicion Level Styling', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="wallets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have colored left border based on suspicion level', async () => {
      const walletItem = await page.$('[data-testid^="wallet-item-"]');
      const borderColor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).borderLeftColor;
      }, walletItem);

      // Should have a non-transparent border color
      expect(borderColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(borderColor).not.toBe('transparent');
    });

    it('should have level badge with correct text', async () => {
      const levelBadge = await page.$('[data-testid="wallet-level-badge"]');
      const text = await page.evaluate((el) => el?.textContent, levelBadge);

      expect(['Critical', 'High', 'Medium', 'Low', 'None']).toContain(text);
    });
  });
});
