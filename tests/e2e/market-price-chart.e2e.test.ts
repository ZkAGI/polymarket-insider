/**
 * E2E Tests for Market Price Chart
 *
 * Tests the interactive price chart component in a real browser using Puppeteer.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Market Price Chart E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const BASE_URL = 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Chart Rendering', () => {
    it('should render price chart on market detail page', async () => {
      await page.goto(`${BASE_URL}/market/test-market-001`);
      await page.waitForSelector('svg', { timeout: 10000 });

      const chartTitle = await page.$eval('h3', (el) => el.textContent);
      expect(chartTitle).toContain('Price History');

      const svg = await page.$('svg');
      expect(svg).toBeTruthy();
    });

    it('should render all chart elements', async () => {
      await page.goto(`${BASE_URL}/market/test-market-002`);
      await page.waitForSelector('svg');

      // Check for axes
      const axisLines = await page.$$('line[stroke-width="2"]');
      expect(axisLines.length).toBeGreaterThanOrEqual(2);

      // Check for line path
      const linePath = await page.$('path[stroke="#3b82f6"]');
      expect(linePath).toBeTruthy();

      // Check for area fill
      const areaPath = await page.$('path[fill="url(#priceGradient)"]');
      expect(areaPath).toBeTruthy();
    });

    it('should render Y-axis with percentage labels', async () => {
      await page.goto(`${BASE_URL}/market/test-market-003`);
      await page.waitForSelector('svg');

      const yLabels = await page.$$eval('text[text-anchor="end"]', (els) =>
        els.map((el) => el.textContent)
      );

      expect(yLabels.length).toBeGreaterThan(0);
      const hasPercentage = yLabels.some((label) => label?.includes('%'));
      expect(hasPercentage).toBe(true);
    });

    it('should render X-axis with date labels', async () => {
      await page.goto(`${BASE_URL}/market/test-market-004`);
      await page.waitForSelector('svg');

      const xLabels = await page.$$('text[text-anchor="middle"]');
      expect(xLabels.length).toBeGreaterThan(0);
    });

    it('should render grid lines', async () => {
      await page.goto(`${BASE_URL}/market/test-market-005`);
      await page.waitForSelector('svg');

      const gridLines = await page.$$('line[stroke-dasharray="4 4"]');
      expect(gridLines.length).toBeGreaterThan(0);
    });
  });

  describe('Time Range Selection', () => {
    it('should have all time range buttons', async () => {
      await page.goto(`${BASE_URL}/market/test-market-006`);
      await page.waitForSelector('svg');

      const buttons = await page.$$eval('button', (els) =>
        els.map((el) => el.textContent).filter((text) => text?.match(/^(1D|1W|1M|3M|6M|ALL)$/))
      );

      expect(buttons.length).toBe(6);
      expect(buttons).toContain('1D');
      expect(buttons).toContain('1W');
      expect(buttons).toContain('1M');
      expect(buttons).toContain('3M');
      expect(buttons).toContain('6M');
      expect(buttons).toContain('ALL');
    });

    it('should highlight selected time range', async () => {
      await page.goto(`${BASE_URL}/market/test-market-007`);
      await page.waitForSelector('svg');

      const selectedButton = await page.$eval('button.bg-blue-600', (el) => el.textContent);
      expect(selectedButton).toBe('1M'); // Default selection
    });

    it('should change time range on button click', async () => {
      await page.goto(`${BASE_URL}/market/test-market-008`);
      await page.waitForSelector('svg');

      // Click 1W button
      await page.click('button:has-text("1W")');
      await page.waitForTimeout(500);

      const selectedButton = await page.$eval('button.bg-blue-600', (el) => el.textContent);
      expect(selectedButton).toBe('1W');
    });

    it('should update chart when changing time range', async () => {
      await page.goto(`${BASE_URL}/market/test-market-009`);
      await page.waitForSelector('svg');

      // Get initial path
      const initialPath = await page.$eval('path[stroke="#3b82f6"]', (el) => el.getAttribute('d'));

      // Change time range
      await page.click('button:has-text("1D")');
      await page.waitForTimeout(500);

      // Get new path
      const newPath = await page.$eval('path[stroke="#3b82f6"]', (el) => el.getAttribute('d'));

      expect(initialPath).not.toBe(newPath);
    });
  });

  describe('Zoom Controls', () => {
    it('should render zoom buttons', async () => {
      await page.goto(`${BASE_URL}/market/test-market-010`);
      await page.waitForSelector('svg');

      const zoomInButton = await page.$('button[aria-label="Zoom in"]');
      const zoomOutButton = await page.$('button[aria-label="Zoom out"]');
      const resetButton = await page.$('button[aria-label="Reset zoom"]');

      expect(zoomInButton).toBeTruthy();
      expect(zoomOutButton).toBeTruthy();
      expect(resetButton).toBeTruthy();
    });

    it('should disable zoom out initially', async () => {
      await page.goto(`${BASE_URL}/market/test-market-011`);
      await page.waitForSelector('svg');

      const zoomOutDisabled = await page.$eval(
        'button[aria-label="Zoom out"]',
        (el) => el.hasAttribute('disabled')
      );

      expect(zoomOutDisabled).toBe(true);
    });

    it('should enable zoom out after zooming in', async () => {
      await page.goto(`${BASE_URL}/market/test-market-012`);
      await page.waitForSelector('svg');

      // Click zoom in
      await page.click('button[aria-label="Zoom in"]');
      await page.waitForTimeout(300);

      const zoomOutDisabled = await page.$eval(
        'button[aria-label="Zoom out"]',
        (el) => el.hasAttribute('disabled')
      );

      expect(zoomOutDisabled).toBe(false);
    });

    it('should display zoom level when zoomed', async () => {
      await page.goto(`${BASE_URL}/market/test-market-013`);
      await page.waitForSelector('svg');

      // Click zoom in
      await page.click('button[aria-label="Zoom in"]');
      await page.waitForTimeout(300);

      const zoomText = await page.$eval('span', (el) => el.textContent);
      expect(zoomText).toContain('Zoom:');
    });

    it('should reset zoom on reset button click', async () => {
      await page.goto(`${BASE_URL}/market/test-market-014`);
      await page.waitForSelector('svg');

      // Zoom in
      await page.click('button[aria-label="Zoom in"]');
      await page.waitForTimeout(300);

      // Reset
      await page.click('button[aria-label="Reset zoom"]');
      await page.waitForTimeout(300);

      const resetDisabled = await page.$eval(
        'button[aria-label="Reset zoom"]',
        (el) => el.hasAttribute('disabled')
      );

      expect(resetDisabled).toBe(true);
    });

    it('should zoom in multiple times', async () => {
      await page.goto(`${BASE_URL}/market/test-market-015`);
      await page.waitForSelector('svg');

      // Zoom in twice
      await page.click('button[aria-label="Zoom in"]');
      await page.waitForTimeout(200);
      await page.click('button[aria-label="Zoom in"]');
      await page.waitForTimeout(200);

      const zoomText = await page.$eval('span', (el) => el.textContent);
      expect(zoomText).toContain('2.');
    });
  });

  describe('Event Markers', () => {
    it('should render event markers', async () => {
      await page.goto(`${BASE_URL}/market/test-market-016`);
      await page.waitForSelector('svg');

      const eventCircles = await page.$$('circle[r="4"]');
      expect(eventCircles.length).toBeGreaterThan(0);
    });

    it('should have tooltips on event markers', async () => {
      await page.goto(`${BASE_URL}/market/test-market-017`);
      await page.waitForSelector('svg');

      const titles = await page.$$eval('title', (els) => els.map((el) => el.textContent));
      expect(titles.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Behavior', () => {
    it('should render on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/market/test-market-018`);
      await page.waitForSelector('svg');

      const svg = await page.$('svg');
      expect(svg).toBeTruthy();
    });

    it('should render on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(`${BASE_URL}/market/test-market-019`);
      await page.waitForSelector('svg');

      const svg = await page.$('svg');
      expect(svg).toBeTruthy();
    });

    it('should render on desktop viewport', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${BASE_URL}/market/test-market-020`);
      await page.waitForSelector('svg');

      const svg = await page.$('svg');
      expect(svg).toBeTruthy();
    });
  });

  describe('Dark Mode', () => {
    it('should render chart in dark mode', async () => {
      await page.goto(`${BASE_URL}/market/test-market-021`);

      // Add dark class to html
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      await page.waitForSelector('svg');
      const svg = await page.$('svg');
      expect(svg).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible zoom buttons', async () => {
      await page.goto(`${BASE_URL}/market/test-market-022`);
      await page.waitForSelector('svg');

      const ariaLabels = await page.$$eval('[aria-label]', (els) =>
        els.map((el) => el.getAttribute('aria-label'))
      );

      expect(ariaLabels).toContain('Zoom in');
      expect(ariaLabels).toContain('Zoom out');
      expect(ariaLabels).toContain('Reset zoom');
    });

    it('should have proper heading', async () => {
      await page.goto(`${BASE_URL}/market/test-market-023`);
      await page.waitForSelector('h3');

      const heading = await page.$eval('h3', (el) => ({
        tag: el.tagName,
        text: el.textContent,
      }));

      expect(heading.tag).toBe('H3');
      expect(heading.text).toContain('Price History');
    });
  });

  describe('Error Handling', () => {
    it('should handle page navigation errors gracefully', async () => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));

      await page.goto(`${BASE_URL}/market/test-market-024`);
      await page.waitForSelector('svg', { timeout: 5000 });

      expect(errors.length).toBe(0);
    });

    it('should not have console errors', async () => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/market/test-market-025`);
      await page.waitForSelector('svg');

      // Filter out known non-critical errors
      const criticalErrors = consoleErrors.filter(
        (error) => !error.includes('Download the React DevTools')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });

  describe('Visual Verification', () => {
    it('should take screenshot of chart', async () => {
      await page.goto(`${BASE_URL}/market/test-market-026`);
      await page.waitForSelector('svg');

      const screenshot = await page.screenshot({
        path: './tests/e2e/screenshots/market-price-chart.png',
        fullPage: false,
      });

      expect(screenshot).toBeTruthy();
    });

    it('should take screenshot of zoomed chart', async () => {
      await page.goto(`${BASE_URL}/market/test-market-027`);
      await page.waitForSelector('svg');

      // Zoom in twice
      await page.click('button[aria-label="Zoom in"]');
      await page.waitForTimeout(200);
      await page.click('button[aria-label="Zoom in"]');
      await page.waitForTimeout(200);

      const screenshot = await page.screenshot({
        path: './tests/e2e/screenshots/market-price-chart-zoomed.png',
        fullPage: false,
      });

      expect(screenshot).toBeTruthy();
    });

    it('should take screenshot of different time ranges', async () => {
      await page.goto(`${BASE_URL}/market/test-market-028`);
      await page.waitForSelector('svg');

      // Test different time ranges
      const ranges = ['1D', '1W', '3M', 'ALL'];
      for (const range of ranges) {
        await page.click(`button:has-text("${range}")`);
        await page.waitForTimeout(300);

        const screenshot = await page.screenshot({
          path: `./tests/e2e/screenshots/market-price-chart-${range}.png`,
          fullPage: false,
        });

        expect(screenshot).toBeTruthy();
      }
    });
  });
});
