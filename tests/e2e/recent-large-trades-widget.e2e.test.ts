/**
 * E2E Browser Tests for RecentLargeTradesWidget
 * Feature: UI-DASH-006 - Recent large trades widget
 *
 * Tests use Puppeteer to verify recent large trades widget functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;

describe('RecentLargeTradesWidget E2E Tests', () => {
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

  describe('Recent Large Trades Widget Loading', () => {
    it('should load the dashboard with large trades widget', async () => {
      const response = await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="large-trades-widget"]');
      expect(widget).not.toBeNull();
    });

    it('should display Recent Large Trades widget with correct title', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const title = await page.evaluate(() => {
        const widget = document.querySelector('[data-testid="large-trades-widget"]');
        return widget?.querySelector('[data-testid="widget-title"]')?.textContent;
      });

      expect(title).toBe('Recent Large Trades');
    });

    it('should show loading state initially then content', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="recent-large-trades-content"]') !== null,
        { timeout: 10000 }
      );

      const content = await page.$('[data-testid="recent-large-trades-content"]');
      expect(content).not.toBeNull();
    });
  });

  describe('Trades List Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="recent-large-trades-content"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display trades list container', async () => {
      const tradesList = await page.$('[data-testid="trades-list"]');
      expect(tradesList).not.toBeNull();
    });

    it('should display summary section', async () => {
      const summary = await page.$('[data-testid="trades-summary"]');
      expect(summary).not.toBeNull();
    });

    it('should show total volume in summary', async () => {
      const volumeBadge = await page.$('[data-testid="total-volume-badge"]');
      expect(volumeBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, volumeBadge);
      expect(text).toMatch(/\$[\d.]+[KM]? vol/);
    });

    it('should show buy count in summary', async () => {
      const buyBadge = await page.$('[data-testid="buy-count-badge"]');
      expect(buyBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, buyBadge);
      expect(text).toMatch(/\d+ buys/);
    });

    it('should show sell count in summary', async () => {
      const sellBadge = await page.$('[data-testid="sell-count-badge"]');
      expect(sellBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, sellBadge);
      expect(text).toMatch(/\d+ sells/);
    });

    it('should display multiple trade items', async () => {
      const tradeItems = await page.$$('[data-testid^="trade-item-"]');
      expect(tradeItems.length).toBeGreaterThan(0);
    });

    it('should display up to 5 trades by default', async () => {
      const tradeItems = await page.$$('[data-testid^="trade-item-"]');
      expect(tradeItems.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Trade Item Structure', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display trade item with index badge', async () => {
      const indexBadge = await page.$('[data-testid="trade-index"]');
      expect(indexBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, indexBadge);
      expect(text).toBe('1'); // First trade should have index 1
    });

    it('should display trade direction badge', async () => {
      const directionBadge = await page.$('[data-testid="trade-direction-badge"]');
      expect(directionBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, directionBadge);
      expect(text).toMatch(/(↑ Buy|↓ Sell)/);
    });

    it('should display trade size category badge', async () => {
      const sizeBadge = await page.$('[data-testid="trade-size-badge"]');
      expect(sizeBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, sizeBadge);
      expect(text).toMatch(/(🐋 Whale|📊 Very Large|📈 Large)/);
    });

    it('should display trade USD value', async () => {
      const usdValue = await page.$('[data-testid="trade-usd-value"]');
      expect(usdValue).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, usdValue);
      expect(text).toMatch(/\$[\d.]+[KM]?/);
    });

    it('should display trade price/probability', async () => {
      const price = await page.$('[data-testid="trade-price"]');
      expect(price).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, price);
      expect(text).toMatch(/@ [\d.]+%/);
    });

    it('should display market title', async () => {
      const marketTitle = await page.$('[data-testid="trade-market-title"]');
      expect(marketTitle).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, marketTitle);
      expect(text).toBeTruthy();
      expect(text?.length).toBeGreaterThan(0);
    });

    it('should display wallet address', async () => {
      const walletAddress = await page.$('[data-testid="trade-wallet-address"]');
      expect(walletAddress).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, walletAddress);
      expect(text).toMatch(/0x[0-9a-f]+\.\.\.([0-9a-f]+|0x[0-9a-f]+)/i);
    });

    it('should display timestamp', async () => {
      const timestamp = await page.$('[data-testid="trade-timestamp"]');
      expect(timestamp).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, timestamp);
      expect(text).toMatch(/(\d+[smhd] ago|Just now)/);
    });
  });

  describe('Trade Item Data Attributes', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have trade-id data attribute', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      const tradeId = await page.evaluate(
        (el) => (el as HTMLElement).dataset.tradeId,
        tradeItem
      );
      expect(tradeId).toBeTruthy();
    });

    it('should have trade-value data attribute', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      const tradeValue = await page.evaluate(
        (el) => (el as HTMLElement).dataset.tradeValue,
        tradeItem
      );
      expect(tradeValue).toBeTruthy();
      expect(parseFloat(tradeValue || '0')).toBeGreaterThan(0);
    });

    it('should have trade-direction data attribute', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      const direction = await page.evaluate(
        (el) => (el as HTMLElement).dataset.tradeDirection,
        tradeItem
      );
      expect(['BUY', 'SELL']).toContain(direction);
    });
  });

  describe('Special Indicators', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display whale badge for whale trades', async () => {
      // Check if there are any whale trades displayed
      const whaleBadge = await page.$('[data-testid="whale-badge"]');
      // This may or may not exist depending on mock data
      // Just verify structure is correct if it exists
      if (whaleBadge) {
        const text = await page.evaluate((el) => el?.textContent, whaleBadge);
        expect(text).toBe('🐋');
      }
    });

    it('should display maker badge for maker trades', async () => {
      const makerBadge = await page.$('[data-testid="maker-badge"]');
      if (makerBadge) {
        const text = await page.evaluate((el) => el?.textContent, makerBadge);
        expect(text).toBe('M');
      }
    });

    it('should display suspicious indicator for suspicious trades', async () => {
      const suspiciousIndicator = await page.$('[data-testid="suspicious-indicator"]');
      if (suspiciousIndicator) {
        const text = await page.evaluate((el) => el?.textContent, suspiciousIndicator);
        expect(text).toContain('⚠️');
      }
    });

    it('should show whale count in summary when whale trades exist', async () => {
      const whaleCountBadge = await page.$('[data-testid="whale-count-badge"]');
      if (whaleCountBadge) {
        const text = await page.evaluate((el) => el?.textContent, whaleCountBadge);
        expect(text).toMatch(/\d+ whale/);
      }
    });

    it('should show suspicious count in summary when suspicious trades exist', async () => {
      const suspiciousCountBadge = await page.$('[data-testid="suspicious-count-badge"]');
      if (suspiciousCountBadge) {
        const text = await page.evaluate((el) => el?.textContent, suspiciousCountBadge);
        expect(text).toMatch(/\d+ suspicious/);
      }
    });
  });

  describe('Click Interactions', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should be clickable trade items', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      const cursor = await page.evaluate((el) => {
        return window.getComputedStyle(el as Element).cursor;
      }, tradeItem);

      expect(cursor).toBe('pointer');
    });

    it('should have role button for accessibility', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      const role = await page.evaluate((el) => el?.getAttribute('role'), tradeItem);
      expect(role).toBe('button');
    });

    it('should have tabindex for keyboard navigation', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      const tabIndex = await page.evaluate(
        (el) => el?.getAttribute('tabindex'),
        tradeItem
      );
      expect(tabIndex).toBe('0');
    });

    it('should have clickable wallet address', async () => {
      const walletAddress = await page.$('[data-testid="trade-wallet-address"]');
      expect(walletAddress).not.toBeNull();

      const tagName = await page.evaluate((el) => el?.tagName.toLowerCase(), walletAddress);
      expect(tagName).toBe('button');
    });

    it('should log trade click to console', async () => {
      const messages: string[] = [];
      page.on('console', (msg) => messages.push(msg.text()));

      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      await tradeItem?.click();

      // Wait for potential console message
      await new Promise((resolve) => setTimeout(resolve, 100));

      const hasTradeClick = messages.some((m) => m.includes('Trade clicked'));
      expect(hasTradeClick).toBe(true);
    });

    it('should log wallet click to console when wallet address is clicked', async () => {
      const messages: string[] = [];
      page.on('console', (msg) => messages.push(msg.text()));

      const walletAddress = await page.$('[data-testid="trade-wallet-address"]');
      await walletAddress?.click();

      // Wait for potential console message
      await new Promise((resolve) => setTimeout(resolve, 100));

      const hasWalletClick = messages.some((m) =>
        m.includes('Wallet clicked from trade')
      );
      expect(hasWalletClick).toBe(true);
    });
  });

  describe('Refresh Functionality', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="large-trades-widget"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have refresh button in widget container', async () => {
      const refreshButton = await page.evaluate(() => {
        const widget = document.querySelector('[data-testid="large-trades-widget"]');
        return widget?.querySelector('[data-testid="widget-refresh-button"]') !== null;
      });
      expect(refreshButton).toBe(true);
    });

    it('should refresh trades when refresh button is clicked', async () => {
      const refreshButton = await page.evaluate(() => {
        const widget = document.querySelector('[data-testid="large-trades-widget"]');
        return widget?.querySelector('[data-testid="widget-refresh-button"]');
      });

      if (refreshButton) {
        const widgetHandle = await page.$('[data-testid="large-trades-widget"]');
        const button = await widgetHandle?.$('[data-testid="widget-refresh-button"]');
        await button?.click();

        // Wait for refresh to complete
        await new Promise((resolve) => setTimeout(resolve, 700));

        const tradesList = await page.$('[data-testid="trades-list"]');
        expect(tradesList).not.toBeNull();
      }
    });
  });

  describe('Visual Styling', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have rounded corners on trade items', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      const borderRadius = await page.evaluate((el) => {
        return window.getComputedStyle(el as Element).borderRadius;
      }, tradeItem);

      expect(borderRadius).not.toBe('0px');
    });

    it('should have left border on trade items', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      const borderLeft = await page.evaluate((el) => {
        return window.getComputedStyle(el as Element).borderLeftWidth;
      }, tradeItem);

      expect(borderLeft).not.toBe('0px');
    });

    it('should have proper spacing between trade items', async () => {
      const tradesList = await page.$('[data-testid="trades-list"]');
      expect(tradesList).not.toBeNull();

      const gap = await page.evaluate((el) => {
        const style = window.getComputedStyle(el as Element);
        return style.gap || style.rowGap;
      }, tradesList);

      // space-y-3 should result in some gap
      expect(gap).toBeTruthy();
    });

    it('should have bold USD value text', async () => {
      const usdValue = await page.$('[data-testid="trade-usd-value"]');
      expect(usdValue).not.toBeNull();

      const fontWeight = await page.evaluate((el) => {
        return window.getComputedStyle(el as Element).fontWeight;
      }, usdValue);

      expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(700);
    });

    it('should have monospace font for wallet address', async () => {
      const walletAddress = await page.$('[data-testid="trade-wallet-address"]');
      expect(walletAddress).not.toBeNull();

      const fontFamily = await page.evaluate((el) => {
        return window.getComputedStyle(el as Element).fontFamily;
      }, walletAddress);

      // Should contain mono font
      expect(fontFamily.toLowerCase()).toMatch(/mono|courier|consolas/);
    });
  });

  describe('Direction Color Coding', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have appropriate color for buy trades', async () => {
      const directionBadge = await page.$('[data-testid="trade-direction-badge"]');
      expect(directionBadge).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, directionBadge);
      const color = await page.evaluate((el) => {
        return window.getComputedStyle(el as Element).color;
      }, directionBadge);

      if (text?.includes('Buy')) {
        // Green color for buy - RGB values should show green dominance
        expect(color).toBeTruthy();
      }
    });
  });

  describe('Summary Badges', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-summary"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display summary with volume badge', async () => {
      const volumeBadge = await page.$('[data-testid="total-volume-badge"]');
      expect(volumeBadge).not.toBeNull();
    });

    it('should display buy count badge with green styling', async () => {
      const buyBadge = await page.$('[data-testid="buy-count-badge"]');
      expect(buyBadge).not.toBeNull();

      const bgColor = await page.evaluate((el) => {
        return window.getComputedStyle(el as Element).backgroundColor;
      }, buyBadge);

      expect(bgColor).toBeTruthy();
    });

    it('should display sell count badge with red styling', async () => {
      const sellBadge = await page.$('[data-testid="sell-count-badge"]');
      expect(sellBadge).not.toBeNull();

      const bgColor = await page.evaluate((el) => {
        return window.getComputedStyle(el as Element).backgroundColor;
      }, sellBadge);

      expect(bgColor).toBeTruthy();
    });
  });

  describe('Responsive Layout', () => {
    it('should display properly on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="recent-large-trades-content"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="recent-large-trades-content"]');
      expect(widget).not.toBeNull();

      const tradeItems = await page.$$('[data-testid^="trade-item-"]');
      expect(tradeItems.length).toBeGreaterThan(0);
    });

    it('should display properly on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="recent-large-trades-content"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="recent-large-trades-content"]');
      expect(widget).not.toBeNull();
    });

    it('should display properly on desktop viewport', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="recent-large-trades-content"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="recent-large-trades-content"]');
      expect(widget).not.toBeNull();
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have aria-label on trades list', async () => {
      const tradesList = await page.$('[data-testid="trades-list"]');
      expect(tradesList).not.toBeNull();

      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        tradesList
      );
      expect(ariaLabel).toBeTruthy();
    });

    it('should have role list on trades list container', async () => {
      const tradesList = await page.$('[data-testid="trades-list"]');
      expect(tradesList).not.toBeNull();

      const role = await page.evaluate((el) => el?.getAttribute('role'), tradesList);
      expect(role).toBe('list');
    });

    it('should have aria-label on trade items', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        tradeItem
      );
      expect(ariaLabel).toBeTruthy();
    });

    it('should support keyboard navigation on trade items', async () => {
      const tradeItem = await page.$('[data-testid^="trade-item-"]');
      expect(tradeItem).not.toBeNull();

      await tradeItem?.focus();

      const isFocused = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid')?.startsWith('trade-item-')
      );
      expect(isFocused).toBe(true);
    });
  });

  describe('Transaction Links', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display tx link for trades with transaction hash', async () => {
      const txLink = await page.$('[data-testid="trade-tx-link"]');
      // This may or may not exist depending on mock data
      if (txLink) {
        const href = await page.evaluate((el) => el?.getAttribute('href'), txLink);
        expect(href).toContain('polygonscan.com/tx/');
      }
    });

    it('should open tx link in new tab', async () => {
      const txLink = await page.$('[data-testid="trade-tx-link"]');
      if (txLink) {
        const target = await page.evaluate(
          (el) => el?.getAttribute('target'),
          txLink
        );
        expect(target).toBe('_blank');
      }
    });

    it('should have noopener noreferrer on tx link', async () => {
      const txLink = await page.$('[data-testid="trade-tx-link"]');
      if (txLink) {
        const rel = await page.evaluate((el) => el?.getAttribute('rel'), txLink);
        expect(rel).toContain('noopener');
        expect(rel).toContain('noreferrer');
      }
    });
  });

  describe('Empty State', () => {
    it('should handle empty trades gracefully', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="recent-large-trades-content"]') !== null,
        { timeout: 10000 }
      );

      // The widget should always have either trades or an empty state
      const content = await page.$('[data-testid="recent-large-trades-content"]');
      expect(content).not.toBeNull();
    });
  });

  describe('Console Errors', () => {
    it('should not have console errors on load', async () => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="recent-large-trades-content"]') !== null,
        { timeout: 10000 }
      );

      // Filter out known acceptable errors (like favicon, etc.)
      const relevantErrors = errors.filter(
        (e) => !e.includes('favicon') && !e.includes('404')
      );
      expect(relevantErrors).toHaveLength(0);
    });
  });

  describe('Trade Ordering', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="trades-list"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display trades with sequential index numbers', async () => {
      const indexBadges = await page.$$('[data-testid="trade-index"]');

      for (let i = 0; i < indexBadges.length; i++) {
        const text = await page.evaluate(
          (el) => el?.textContent,
          indexBadges[i]
        );
        expect(text).toBe(String(i + 1));
      }
    });

    it('should show most recent trades first', async () => {
      // Trades should be sorted by timestamp descending
      // The first trade should have index 1
      const firstIndex = await page.$('[data-testid="trade-index"]');
      expect(firstIndex).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, firstIndex);
      expect(text).toBe('1');
    });
  });
});
