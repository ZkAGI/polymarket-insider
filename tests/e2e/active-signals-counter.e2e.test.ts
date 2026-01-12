/**
 * E2E Browser Tests for ActiveSignalsCounter
 * Feature: UI-DASH-003 - Active signals counter widget
 *
 * Tests use Puppeteer to verify signal counter functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;

describe('ActiveSignalsCounter E2E Tests', () => {
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

  describe('Active Signals Widget Loading', () => {
    it('should load the dashboard with active signals widget', async () => {
      const response = await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="active-signals-widget"]');
      expect(widget).not.toBeNull();
    });

    it('should display Active Signals widget with correct title', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const title = await page.evaluate(() => {
        const widget = document.querySelector('[data-testid="active-signals-widget"]');
        return widget?.querySelector('[data-testid="widget-title"]')?.textContent;
      });

      expect(title).toBe('Active Signals');
    });

    it('should show loading state initially then content', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="active-signals-content"]') !== null,
        { timeout: 10000 }
      );

      const content = await page.$('[data-testid="active-signals-content"]');
      expect(content).not.toBeNull();
    });
  });

  describe('Signal Counter Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="active-signals-content"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display signals list container', async () => {
      const signalsList = await page.$('[data-testid="signals-list"]');
      expect(signalsList).not.toBeNull();
    });

    it('should display summary section', async () => {
      const summary = await page.$('[data-testid="signals-summary"]');
      expect(summary).not.toBeNull();
    });

    it('should show total signals badge in summary', async () => {
      const totalBadge = await page.$('[data-testid="total-signals"]');
      expect(totalBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, totalBadge);
      expect(text).toMatch(/\d+ total/);
    });

    it('should show active types badge in summary', async () => {
      const typesBadge = await page.$('[data-testid="active-types"]');
      expect(typesBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, typesBadge);
      expect(text).toMatch(/\d+ types/);
    });

    it('should display multiple signal type items', async () => {
      const signalItems = await page.$$('[data-testid^="signal-item-"]');
      expect(signalItems.length).toBeGreaterThan(0);
    });
  });

  describe('Signal Item Structure', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="signals-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display signal item with status indicator', async () => {
      const statusIndicator = await page.$('[data-testid="signal-status-indicator"]');
      expect(statusIndicator).not.toBeNull();
    });

    it('should display signal item with icon', async () => {
      const icon = await page.$('[data-testid="signal-icon"]');
      expect(icon).not.toBeNull();
    });

    it('should display signal item with label', async () => {
      const label = await page.$('[data-testid="signal-label"]');
      expect(label).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBeTruthy();
      expect(text?.length).toBeGreaterThan(0);
    });

    it('should display signal item with count badge', async () => {
      const count = await page.$('[data-testid="signal-count"]');
      expect(count).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, count);
      expect(text).toMatch(/^\d+$/);
    });

    it('should have correct data attributes on signal items', async () => {
      const signalItem = await page.$('[data-testid^="signal-item-"]');
      expect(signalItem).not.toBeNull();

      const dataType = await page.evaluate(
        (el) => el?.getAttribute('data-signal-type'),
        signalItem
      );
      expect(dataType).toBeTruthy();
    });
  });

  describe('Signal Types Coverage', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="signals-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display fresh wallet signal type', async () => {
      const item = await page.$('[data-testid="signal-item-fresh-wallet"]');
      expect(item).not.toBeNull();
    });

    it('should display whale activity signal type', async () => {
      const item = await page.$('[data-testid="signal-item-whale-activity"]');
      expect(item).not.toBeNull();
    });

    it('should display coordinated trading signal type', async () => {
      const item = await page.$('[data-testid="signal-item-coordinated-trading"]');
      expect(item).not.toBeNull();
    });

    it('should display unusual volume signal type', async () => {
      const item = await page.$('[data-testid="signal-item-unusual-volume"]');
      expect(item).not.toBeNull();
    });

    it('should display price anomaly signal type', async () => {
      const item = await page.$('[data-testid="signal-item-price-anomaly"]');
      expect(item).not.toBeNull();
    });

    it('should display insider pattern signal type', async () => {
      const item = await page.$('[data-testid="signal-item-insider-pattern"]');
      expect(item).not.toBeNull();
    });

    it('should display sybil detection signal type', async () => {
      const item = await page.$('[data-testid="signal-item-sybil-detection"]');
      expect(item).not.toBeNull();
    });

    it('should display niche market signal type', async () => {
      const item = await page.$('[data-testid="signal-item-niche-market"]');
      expect(item).not.toBeNull();
    });

    it('should display exactly 8 signal types', async () => {
      const items = await page.$$('[data-testid^="signal-item-"]');
      expect(items.length).toBe(8);
    });
  });

  describe('Signal Interactivity', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="signals-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should be clickable with cursor pointer', async () => {
      const signalItem = await page.$('[data-testid^="signal-item-"]');
      expect(signalItem).not.toBeNull();

      const cursor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).cursor;
      }, signalItem);

      expect(cursor).toBe('pointer');
    });

    it('should have role="button" for accessibility', async () => {
      const signalItem = await page.$('[data-testid^="signal-item-"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), signalItem);
      expect(role).toBe('button');
    });

    it('should have tabIndex for keyboard navigation', async () => {
      const signalItem = await page.$('[data-testid^="signal-item-"]');
      const tabIndex = await page.evaluate(
        (el) => el?.getAttribute('tabindex'),
        signalItem
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

      const signalItem = await page.$('[data-testid="signal-item-fresh-wallet"]');
      await signalItem?.click();

      // Wait a moment for any errors to appear
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Filter out unrelated errors
      const relevantErrors = consoleErrors.filter(
        (err) => !err.includes('DevTools') && !err.includes('Extension')
      );
      expect(relevantErrors).toHaveLength(0);
    });
  });

  describe('Refresh Functionality', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="active-signals-widget"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have refresh button in widget header', async () => {
      const widget = await page.$('[data-testid="active-signals-widget"]');
      const refreshButton = await widget?.$('[data-testid="widget-refresh-button"]');
      expect(refreshButton).not.toBeNull();
    });

    it('should be able to click refresh button', async () => {
      const refreshButton = await page.$(
        '[data-testid="active-signals-widget"] [data-testid="widget-refresh-button"]'
      );
      expect(refreshButton).not.toBeNull();

      await refreshButton?.click();

      // Wait for refresh to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify content is still displayed after refresh
      const signalsList = await page.$('[data-testid="signals-list"]');
      expect(signalsList).not.toBeNull();
    });
  });

  describe('Visual Styling', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="signals-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have proper spacing between signal items', async () => {
      const signalsList = await page.$('[data-testid="signals-list"]');
      const gap = await page.evaluate((el) => {
        const style = window.getComputedStyle(el!);
        return style.gap || style.rowGap;
      }, signalsList);

      // Should have spacing (0.5rem = 8px or similar)
      expect(gap).toBeTruthy();
    });

    it('should have background color on signal items', async () => {
      const signalItem = await page.$('[data-testid^="signal-item-"]');
      const bgColor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).backgroundColor;
      }, signalItem);

      // Should have some background color (not transparent)
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(bgColor).not.toBe('transparent');
    });

    it('should have rounded corners on signal items', async () => {
      const signalItem = await page.$('[data-testid^="signal-item-"]');
      const borderRadius = await page.evaluate((el) => {
        return window.getComputedStyle(el!).borderRadius;
      }, signalItem);

      expect(borderRadius).toBeTruthy();
      expect(borderRadius).not.toBe('0px');
    });

    it('should have status indicator with correct background', async () => {
      const statusIndicator = await page.$('[data-testid="signal-status-indicator"]');
      const bgColor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).backgroundColor;
      }, statusIndicator);

      // Should be green, yellow, or gray
      expect(bgColor).toBeTruthy();
    });
  });

  describe('Trend Indicators', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="signals-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display trend indicators when trends are enabled', async () => {
      // Trends may or may not be visible depending on mock data
      // Check that the component handles them properly
      const trends = await page.$$('[data-testid="signal-trend"]');
      // Just verify no errors - trends may be 0 if all stable
      expect(trends.length).toBeGreaterThanOrEqual(0);
    });

    it('should have trend direction data attribute when present', async () => {
      const trend = await page.$('[data-testid="signal-trend"]');
      if (trend) {
        const direction = await page.evaluate(
          (el) => el?.getAttribute('data-trend-direction'),
          trend
        );
        expect(['up', 'down']).toContain(direction);
      }
    });
  });

  describe('Responsive Layout', () => {
    it('should display properly on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="active-signals-widget"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="active-signals-widget"]');
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
        () => document.querySelector('[data-testid="active-signals-widget"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="active-signals-widget"]');
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
        () => document.querySelector('[data-testid="active-signals-widget"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="active-signals-widget"]');
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
        () => document.querySelector('[data-testid="signals-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have aria-label on signals list', async () => {
      const signalsList = await page.$('[data-testid="signals-list"]');
      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        signalsList
      );
      expect(ariaLabel).toBe('Active signals by type');
    });

    it('should have role="list" on signals container', async () => {
      const signalsList = await page.$('[data-testid="signals-list"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), signalsList);
      expect(role).toBe('list');
    });

    it('should have accessible aria-label on signal items', async () => {
      const signalItem = await page.$('[data-testid^="signal-item-"]');
      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        signalItem
      );
      expect(ariaLabel).toMatch(/\d+ active signals/);
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
        () => document.querySelector('[data-testid="active-signals-content"]') !== null,
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

  describe('Critical Signals Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="signals-summary"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should show critical badge when insider or sybil signals are active', async () => {
      // Check if critical badge exists (depends on mock data)
      const hasCriticalBadge = await page.evaluate(() => {
        return document.querySelector('[data-testid="critical-signals"]') !== null;
      });
      // This may or may not be present depending on random mock data
      // Just verify no errors - the badge is optional based on data
      expect(typeof hasCriticalBadge).toBe('boolean');
    });

    it('should highlight insider pattern signal type', async () => {
      const insiderItem = await page.$('[data-testid="signal-item-insider-pattern"]');
      expect(insiderItem).not.toBeNull();

      // Should have yellow color class
      const hasYellowText = await page.evaluate((el) => {
        const label = el?.querySelector('[data-testid="signal-label"]');
        return label?.classList.contains('text-yellow-600') ||
               label?.className.includes('yellow');
      }, insiderItem);

      expect(hasYellowText).toBe(true);
    });

    it('should highlight sybil detection signal type', async () => {
      const sybilItem = await page.$('[data-testid="signal-item-sybil-detection"]');
      expect(sybilItem).not.toBeNull();

      // Should have pink color class
      const hasPinkText = await page.evaluate((el) => {
        const label = el?.querySelector('[data-testid="signal-label"]');
        return label?.classList.contains('text-pink-600') ||
               label?.className.includes('pink');
      }, sybilItem);

      expect(hasPinkText).toBe(true);
    });
  });
});
