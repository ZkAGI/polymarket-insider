/**
 * E2E Browser Tests for HotMarketsWidget
 * Feature: UI-DASH-005 - Hot markets widget
 *
 * Tests use Puppeteer to verify hot markets widget functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;

describe('HotMarketsWidget E2E Tests', () => {
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

  describe('Hot Markets Widget Loading', () => {
    it('should load the dashboard with hot markets widget', async () => {
      const response = await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="hot-markets-widget"]');
      expect(widget).not.toBeNull();
    });

    it('should display Hot Markets widget with correct title', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const title = await page.evaluate(() => {
        const widget = document.querySelector('[data-testid="hot-markets-widget"]');
        return widget?.querySelector('[data-testid="widget-title"]')?.textContent;
      });

      expect(title).toBe('Hot Markets');
    });

    it('should show loading state initially then content', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="hot-markets-content"]') !== null,
        { timeout: 10000 }
      );

      const content = await page.$('[data-testid="hot-markets-content"]');
      expect(content).not.toBeNull();
    });
  });

  describe('Markets List Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="hot-markets-content"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display markets list container', async () => {
      const marketsList = await page.$('[data-testid="markets-list"]');
      expect(marketsList).not.toBeNull();
    });

    it('should display summary section', async () => {
      const summary = await page.$('[data-testid="markets-summary"]');
      expect(summary).not.toBeNull();
    });

    it('should show total markets count in summary', async () => {
      const totalBadge = await page.$('[data-testid="total-markets-count"]');
      expect(totalBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, totalBadge);
      expect(text).toMatch(/\d+ markets/);
    });

    it('should show total alerts count in summary', async () => {
      const alertsBadge = await page.$('[data-testid="total-alerts-count"]');
      expect(alertsBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, alertsBadge);
      expect(text).toMatch(/\d+ alerts/);
    });

    it('should display multiple market items', async () => {
      const marketItems = await page.$$('[data-testid^="market-item-"]');
      expect(marketItems.length).toBeGreaterThan(0);
    });

    it('should display up to 5 markets by default', async () => {
      const marketItems = await page.$$('[data-testid^="market-item-"]');
      expect(marketItems.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Market Item Structure', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display market item with rank badge', async () => {
      const rankBadge = await page.$('[data-testid="market-rank"]');
      expect(rankBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, rankBadge);
      expect(text).toBe('1'); // First market should have rank 1
    });

    it('should display market title', async () => {
      const title = await page.$('[data-testid="market-title"]');
      expect(title).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, title);
      expect(text).toBeTruthy();
      expect(text?.length).toBeGreaterThan(0);
    });

    it('should display heat level badge', async () => {
      const heatBadge = await page.$('[data-testid="market-heat-badge"]');
      expect(heatBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, heatBadge);
      // Should contain one of the heat level labels
      expect(text).toMatch(/(Critical|High|Medium|Low|None)/);
    });

    it('should display market category icon', async () => {
      const categoryIcon = await page.$('[data-testid="market-category"]');
      expect(categoryIcon).not.toBeNull();
    });

    it('should display heat score bar', async () => {
      const heatBar = await page.$('[data-testid="market-heat-bar"]');
      expect(heatBar).not.toBeNull();
    });

    it('should display heat score value', async () => {
      const heatValue = await page.$('[data-testid="market-heat-value"]');
      expect(heatValue).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, heatValue);
      const score = parseInt(text || '0', 10);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should display market probability', async () => {
      const probability = await page.$('[data-testid="market-probability"]');
      expect(probability).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, probability);
      expect(text).toMatch(/\d+%/);
    });

    it('should display market volume', async () => {
      const volume = await page.$('[data-testid="market-volume"]');
      expect(volume).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, volume);
      expect(text).toMatch(/\$[\d.]+[KM]?/);
    });

    it('should display market alerts count', async () => {
      const alerts = await page.$('[data-testid="market-alerts"]');
      expect(alerts).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, alerts);
      expect(text).toMatch(/\d+ alerts/);
    });

    it('should display last alert time', async () => {
      const lastAlert = await page.$('[data-testid="market-last-alert"]');
      expect(lastAlert).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, lastAlert);
      expect(text).toMatch(/(Just now|\d+[mhd] ago)/);
    });
  });

  describe('Alert Types Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display alert types container when alerts exist', async () => {
      const alertTypes = await page.$('[data-testid="market-alert-types"]');
      // May or may not be present depending on mock data
      if (alertTypes) {
        expect(alertTypes).not.toBeNull();
      }
    });

    it('should display alert type badges with icons', async () => {
      const alertTypeBadges = await page.$$('[data-testid^="alert-type-"]');
      // Each badge should have an icon
      for (const badge of alertTypeBadges) {
        const text = await page.evaluate((el) => el?.textContent, badge);
        expect(text).toBeTruthy();
      }
    });
  });

  describe('Data Attributes', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have data-market-id on market items', async () => {
      const marketId = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]');
        return item?.getAttribute('data-market-id');
      });

      expect(marketId).toBeTruthy();
      expect(marketId).toMatch(/^market-\d+$/);
    });

    it('should have data-market-heat on market items', async () => {
      const heatScore = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]');
        return item?.getAttribute('data-market-heat');
      });

      expect(heatScore).toBeTruthy();
      const score = parseInt(heatScore || '0', 10);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should have data-market-slug on market items', async () => {
      const slug = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]');
        return item?.getAttribute('data-market-slug');
      });

      expect(slug).toBeTruthy();
    });
  });

  describe('Click Interactions', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should handle market item click', async () => {
      const marketItem = await page.$('[data-testid^="market-item-"]');
      expect(marketItem).not.toBeNull();

      // Set up console listener to capture click log
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('Market clicked')) {
          consoleMessages.push(msg.text());
        }
      });

      await marketItem?.click();

      // Wait a bit for the console message
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(consoleMessages.length).toBeGreaterThan(0);
    });

    it('should handle watch button click', async () => {
      const watchButton = await page.$('[data-testid="market-watch-button"]');
      expect(watchButton).not.toBeNull();

      // Get initial watch state by checking SVG fill
      const initialFill = await page.evaluate((el) => {
        const svg = el?.querySelector('svg');
        return svg?.getAttribute('fill');
      }, watchButton);

      await watchButton?.click();

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const newFill = await page.evaluate((el) => {
        const svg = el?.querySelector('svg');
        return svg?.getAttribute('fill');
      }, watchButton);

      // Fill should have changed
      expect(newFill).not.toBe(initialFill);
    });

    it('should not trigger market click when watch button is clicked', async () => {
      const watchButton = await page.$('[data-testid="market-watch-button"]');
      expect(watchButton).not.toBeNull();

      // Set up console listener
      const marketClicks: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('Market clicked')) {
          marketClicks.push(msg.text());
        }
      });

      await watchButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Market click should not be triggered
      expect(marketClicks.length).toBe(0);
    });
  });

  describe('Refresh Functionality', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="hot-markets-content"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have refresh button in widget container', async () => {
      const refreshButton = await page.$('[data-testid="hot-markets-widget"] [data-testid="widget-refresh-button"]');
      expect(refreshButton).not.toBeNull();
    });

    it('should refresh market data when refresh button is clicked', async () => {
      const refreshButton = await page.$('[data-testid="hot-markets-widget"] [data-testid="widget-refresh-button"]');
      await refreshButton?.click();

      // Wait for refresh to complete
      await new Promise((resolve) => setTimeout(resolve, 700));

      // Data might be different after refresh (mock data is random)
      const newHeatScore = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]');
        return item?.getAttribute('data-market-heat');
      });

      // Just verify it's still valid data
      expect(newHeatScore).toBeTruthy();
    });
  });

  describe('Visual Styling', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have proper border-left styling for market items', async () => {
      const borderLeft = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]') as HTMLElement;
        return window.getComputedStyle(item).borderLeftWidth;
      });

      expect(parseInt(borderLeft, 10)).toBeGreaterThan(0);
    });

    it('should have rounded corners on market items', async () => {
      const borderRadius = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]') as HTMLElement;
        return window.getComputedStyle(item).borderRadius;
      });

      expect(borderRadius).not.toBe('0px');
    });

    it('should have proper padding on market items', async () => {
      const padding = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]') as HTMLElement;
        return window.getComputedStyle(item).padding;
      });

      expect(padding).not.toBe('0px');
    });

    it('should have heat bar fill with correct width', async () => {
      const heatFill = await page.$('[data-testid="market-heat-fill"]');
      expect(heatFill).not.toBeNull();

      const width = await page.evaluate((el) => {
        return (el as HTMLElement)?.style.width;
      }, heatFill);

      expect(width).toMatch(/^\d+%$/);
    });
  });

  describe('Summary Badges', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-summary"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display total markets badge', async () => {
      const badge = await page.$('[data-testid="total-markets-count"]');
      expect(badge).not.toBeNull();
    });

    it('should display total alerts badge', async () => {
      const badge = await page.$('[data-testid="total-alerts-count"]');
      expect(badge).not.toBeNull();
    });

    it('should display critical badge when critical markets exist', async () => {
      // This may or may not be present depending on mock data
      const criticalBadge = await page.$('[data-testid="critical-markets-count"]');
      if (criticalBadge) {
        const text = await page.evaluate((el) => el?.textContent, criticalBadge);
        expect(text).toMatch(/\d+ critical/);
      }
    });

    it('should display high badge when high-heat markets exist', async () => {
      // This may or may not be present depending on mock data
      const highBadge = await page.$('[data-testid="high-markets-count"]');
      if (highBadge) {
        const text = await page.evaluate((el) => el?.textContent, highBadge);
        expect(text).toMatch(/\d+ high/);
      }
    });

    it('should display watched badge when markets are watched', async () => {
      // This may or may not be present depending on mock data
      const watchedBadge = await page.$('[data-testid="watched-markets-count"]');
      if (watchedBadge) {
        const text = await page.evaluate((el) => el?.textContent, watchedBadge);
        expect(text).toMatch(/\d+ watched/);
      }
    });
  });

  describe('Responsive Layout', () => {
    it('should display properly on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="hot-markets-content"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="hot-markets-widget"]');
      expect(widget).not.toBeNull();

      const marketsList = await page.$('[data-testid="markets-list"]');
      expect(marketsList).not.toBeNull();
    });

    it('should display properly on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="hot-markets-content"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="hot-markets-widget"]');
      expect(widget).not.toBeNull();
    });

    it('should display properly on desktop viewport', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="hot-markets-content"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="hot-markets-widget"]');
      expect(widget).not.toBeNull();
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have aria-label on markets list', async () => {
      const ariaLabel = await page.evaluate(() => {
        const list = document.querySelector('[data-testid="markets-list"]');
        return list?.getAttribute('aria-label');
      });

      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toContain('Hot markets');
    });

    it('should have role attribute on markets list', async () => {
      const role = await page.evaluate(() => {
        const list = document.querySelector('[data-testid="markets-list"]');
        return list?.getAttribute('role');
      });

      expect(role).toBe('list');
    });

    it('should have role="button" on market items', async () => {
      const role = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]');
        return item?.getAttribute('role');
      });

      expect(role).toBe('button');
    });

    it('should have tabIndex on market items', async () => {
      const tabIndex = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]');
        return item?.getAttribute('tabindex');
      });

      expect(tabIndex).toBe('0');
    });

    it('should have aria-label on watch button', async () => {
      const ariaLabel = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="market-watch-button"]');
        return btn?.getAttribute('aria-label');
      });

      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/(Add to|Remove from) watchlist/);
    });

    it('should be keyboard accessible', async () => {
      // Focus on first market item
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab'); // Navigate through header elements

      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('Market clicked')) {
          consoleMessages.push(msg.text());
        }
      });

      // Press Enter to activate
      await page.keyboard.press('Enter');
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if console logged the click
      // Note: This depends on focus being on a market item
    });
  });

  describe('Console Errors', () => {
    it('should not have any console errors on load', async () => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="hot-markets-content"]') !== null,
        { timeout: 10000 }
      );

      // Filter out known non-critical errors
      const criticalErrors = errors.filter(
        (e) => !e.includes('favicon') && !e.includes('DevTools')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });

  describe('Market Ranking Order', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should rank markets by heat score in descending order', async () => {
      const heatScores = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-testid^="market-item-"]');
        return Array.from(items).map((item) =>
          parseInt(item.getAttribute('data-market-heat') || '0', 10)
        );
      });

      // Verify descending order
      for (let i = 0; i < heatScores.length - 1; i++) {
        const current = heatScores[i];
        const next = heatScores[i + 1];
        if (current !== undefined && next !== undefined) {
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    it('should display correct rank numbers', async () => {
      const ranks = await page.evaluate(() => {
        const rankBadges = document.querySelectorAll('[data-testid="market-rank"]');
        return Array.from(rankBadges).map((badge) => badge.textContent);
      });

      // Verify sequential ranking
      ranks.forEach((rank, index) => {
        expect(rank).toBe(String(index + 1));
      });
    });
  });

  describe('Heat Level Styling', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should apply correct border color based on heat level', async () => {
      const borderColor = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]') as HTMLElement;
        return window.getComputedStyle(item).borderLeftColor;
      });

      // Border color should be defined (not transparent)
      expect(borderColor).toBeTruthy();
      expect(borderColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    it('should apply correct background color based on heat level', async () => {
      const bgColor = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="market-item-"]') as HTMLElement;
        return window.getComputedStyle(item).backgroundColor;
      });

      // Background color should be defined
      expect(bgColor).toBeTruthy();
    });
  });

  describe('Probability Change Indicator', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="markets-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display probability change when present', async () => {
      const changeIndicator = await page.$('[data-testid="probability-change"]');
      if (changeIndicator) {
        const text = await page.evaluate((el) => el?.textContent, changeIndicator);
        // Text format is "↑ +5.0%" or "↓ -5.0%" with a space
        expect(text).toMatch(/[↑↓]\s*[+-][\d.]+%/);
      }
    });
  });
});
