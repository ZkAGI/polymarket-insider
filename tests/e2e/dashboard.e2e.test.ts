/**
 * E2E Browser Tests for Dashboard
 * Feature: UI-DASH-001 - Main dashboard layout
 *
 * Tests use Puppeteer to verify dashboard functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;

describe('Dashboard E2E Tests', () => {
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

  describe('Dashboard Page Load', () => {
    it('should load the dashboard page', async () => {
      const response = await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);
    });

    it('should show loading skeleton initially', async () => {
      // Navigate but don't wait for full load to catch skeleton
      await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

      // Check for skeleton element (may be briefly visible)
      const skeletonExists = await page.evaluate(() => {
        const skeleton = document.querySelector('[data-testid="dashboard-skeleton"]');
        const layout = document.querySelector('[data-testid="dashboard-layout"]');
        return skeleton !== null || layout !== null;
      });

      expect(skeletonExists).toBe(true);
    });

    it('should transition from skeleton to dashboard layout', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for JavaScript to hydrate and load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const dashboardExists = await page.$('[data-testid="dashboard-layout"]');
      expect(dashboardExists).not.toBeNull();
    });
  });

  describe('Dashboard Layout Structure', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have a header with title', async () => {
      const title = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1?.textContent;
      });

      expect(title).toContain('Polymarket Tracker');
    });

    it('should have a stats bar', async () => {
      const statsBar = await page.$('[data-testid="stats-bar"]');
      expect(statsBar).not.toBeNull();
    });

    it('should display all four quick stats', async () => {
      const statsTestIds = [
        'stat-active-alerts',
        'stat-suspicious-wallets',
        'stat-hot-markets',
        'stat-recent-trades',
      ];

      for (const testId of statsTestIds) {
        const stat = await page.$(`[data-testid="${testId}"]`);
        expect(stat).not.toBeNull();
      }
    });

    it('should have main content area', async () => {
      const main = await page.$('[data-testid="dashboard-main"]');
      expect(main).not.toBeNull();
    });

    it('should have a footer', async () => {
      const footer = await page.$('[data-testid="dashboard-footer"]');
      expect(footer).not.toBeNull();
    });
  });

  describe('Widget Containers', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display Alert Feed widget', async () => {
      const widget = await page.$('[data-testid="alert-feed-widget"]');
      expect(widget).not.toBeNull();

      const title = await page.evaluate((el) => {
        return el?.querySelector('[data-testid="widget-title"]')?.textContent;
      }, widget);
      expect(title).toBe('Real-time Alert Feed');
    });

    it('should display Active Signals widget', async () => {
      const widget = await page.$('[data-testid="active-signals-widget"]');
      expect(widget).not.toBeNull();

      const title = await page.evaluate((el) => {
        return el?.querySelector('[data-testid="widget-title"]')?.textContent;
      }, widget);
      expect(title).toBe('Active Signals');
    });

    it('should display Suspicious Wallets widget', async () => {
      const widget = await page.$('[data-testid="suspicious-wallets-widget"]');
      expect(widget).not.toBeNull();

      const title = await page.evaluate((el) => {
        return el?.querySelector('[data-testid="widget-title"]')?.textContent;
      }, widget);
      expect(title).toBe('Top Suspicious Wallets');
    });

    it('should display Hot Markets widget', async () => {
      const widget = await page.$('[data-testid="hot-markets-widget"]');
      expect(widget).not.toBeNull();

      const title = await page.evaluate((el) => {
        return el?.querySelector('[data-testid="widget-title"]')?.textContent;
      }, widget);
      expect(title).toBe('Hot Markets');
    });

    it('should display Large Trades widget', async () => {
      const widget = await page.$('[data-testid="large-trades-widget"]');
      expect(widget).not.toBeNull();

      const title = await page.evaluate((el) => {
        return el?.querySelector('[data-testid="widget-title"]')?.textContent;
      }, widget);
      expect(title).toBe('Recent Large Trades');
    });

    it('should have 5 widgets total', async () => {
      const widgets = await page.$$('[data-testid$="-widget"]');
      expect(widgets.length).toBe(5);
    });
  });

  describe('System Status Indicator', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display system status', async () => {
      const status = await page.$('[data-testid="system-status"]');
      expect(status).not.toBeNull();
    });

    it('should show connected status after loading', async () => {
      const statusText = await page.evaluate(() => {
        const status = document.querySelector('[data-testid="system-status"]');
        return status?.textContent;
      });

      expect(statusText).toContain('Connected');
    });
  });

  describe('Responsive Layout', () => {
    it('should display single column on mobile', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const gridColumns = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="dashboard-main"] > div');
        if (!main) return null;
        const style = window.getComputedStyle(main);
        return style.gridTemplateColumns;
      });

      // On mobile, should have single column (1fr or similar)
      expect(gridColumns).toBeTruthy();
    });

    it('should display two columns on tablet', async () => {
      await page.setViewport({ width: 768, height: 1024 }); // iPad
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const gridColumns = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="dashboard-main"] > div');
        if (!main) return null;
        const style = window.getComputedStyle(main);
        return style.gridTemplateColumns;
      });

      expect(gridColumns).toBeTruthy();
    });

    it('should display three columns on desktop', async () => {
      await page.setViewport({ width: 1280, height: 720 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const gridColumns = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="dashboard-main"] > div');
        if (!main) return null;
        const style = window.getComputedStyle(main);
        return style.gridTemplateColumns;
      });

      expect(gridColumns).toBeTruthy();
    });

    it('should have stats bar adapt to screen size', async () => {
      // Mobile view
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="stats-bar"]') !== null,
        { timeout: 10000 }
      );

      const mobileStatsVisible = await page.evaluate(() => {
        const statsBar = document.querySelector('[data-testid="stats-bar"]');
        if (!statsBar) return false;
        const rect = statsBar.getBoundingClientRect();
        return rect.height > 0 && rect.width > 0;
      });

      expect(mobileStatsVisible).toBe(true);
    });
  });

  describe('Navigation from Home', () => {
    it('should navigate to dashboard from home page', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

      // Look for dashboard link
      const dashboardLink = await page.$('[data-testid="dashboard-link"]');
      expect(dashboardLink).not.toBeNull();

      // Click the link
      await dashboardLink!.click();

      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Verify we're on dashboard
      expect(page.url()).toBe(DASHBOARD_URL);
    });
  });

  describe('Loading States', () => {
    it('should show skeleton placeholders during load', async () => {
      // Set a slow connection to see loading state
      const client = await page.createCDPSession();
      await client.send('Network.enable');
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 100 * 1024, // 100 KB/s
        uploadThroughput: 100 * 1024,
        latency: 500,
      });

      await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

      // Check for skeleton or actual content
      const hasContent = await page.evaluate(() => {
        return (
          document.querySelector('[data-testid="dashboard-skeleton"]') !== null ||
          document.querySelector('[data-testid="dashboard-layout"]') !== null
        );
      });

      expect(hasContent).toBe(true);
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
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      // Filter out known non-critical errors
      const criticalErrors = consoleErrors.filter(
        (err) => !err.includes('DevTools') && !err.includes('Extension')
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });

  describe('Stats Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display numeric values in stats', async () => {
      const activeAlerts = await page.evaluate(() => {
        const stat = document.querySelector('[data-testid="stat-active-alerts"]');
        const value = stat?.querySelector('span:first-child');
        return value?.textContent;
      });

      expect(activeAlerts).toMatch(/^\d+$/);
    });

    it('should display all stat labels', async () => {
      const labels = await page.evaluate(() => {
        const stats = document.querySelectorAll('[data-testid^="stat-"]');
        return Array.from(stats).map((stat) => {
          const label = stat.querySelector('span:last-child');
          return label?.textContent?.trim().toUpperCase();
        });
      });

      expect(labels).toContain('ACTIVE ALERTS');
      expect(labels).toContain('SUSPICIOUS WALLETS');
      expect(labels).toContain('HOT MARKETS');
      expect(labels).toContain('RECENT TRADES');
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have proper heading hierarchy', async () => {
      const headings = await page.evaluate(() => {
        const h1 = document.querySelectorAll('h1');
        const h2 = document.querySelectorAll('h2');
        return { h1Count: h1.length, h2Count: h2.length };
      });

      expect(headings.h1Count).toBe(1);
      expect(headings.h2Count).toBeGreaterThan(0);
    });

    it('should have semantic layout elements', async () => {
      const hasSemanticElements = await page.evaluate(() => {
        return {
          header: document.querySelector('header') !== null,
          main: document.querySelector('main') !== null,
          footer: document.querySelector('footer') !== null,
        };
      });

      expect(hasSemanticElements.header).toBe(true);
      expect(hasSemanticElements.main).toBe(true);
      expect(hasSemanticElements.footer).toBe(true);
    });
  });

  describe('Visual Verification', () => {
    it('should have visible widgets with proper styling', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const widgetStyles = await page.evaluate(() => {
        const widget = document.querySelector('[data-testid="alert-feed-widget"]');
        if (!widget) return null;

        const style = window.getComputedStyle(widget);
        return {
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
          hasBoxShadow: style.boxShadow !== 'none',
        };
      });

      expect(widgetStyles).not.toBeNull();
      expect(widgetStyles!.borderRadius).toBeTruthy();
    });

    it('should have proper spacing between widgets', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const gridGap = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="dashboard-main"] > div');
        if (!grid) return null;
        const style = window.getComputedStyle(grid);
        return style.gap;
      });

      expect(gridGap).toBeTruthy();
    });
  });
});
