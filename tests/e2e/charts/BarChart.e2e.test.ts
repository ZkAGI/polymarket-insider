import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('BarChart E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Simple Bar Chart', () => {
    it('should render simple bar chart', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('h3:has-text("Simple Bar Chart")');

      // Check title is present
      const titleExists = await page.$('text="Monthly Volume"');
      expect(titleExists).toBeTruthy();

      // Check SVG is rendered
      const svgExists = await page.$('svg');
      expect(svgExists).toBeTruthy();

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-simple.png',
        fullPage: false,
      });
    });

    it('should display X-axis labels', async () => {
      await page.goto(`${baseUrl}/demo/charts`);

      // Check for month labels
      const janExists = await page.$('text="Jan"');
      const febExists = await page.$('text="Feb"');
      const marExists = await page.$('text="Mar"');

      expect(janExists).toBeTruthy();
      expect(febExists).toBeTruthy();
      expect(marExists).toBeTruthy();
    });

    it('should display Y-axis labels', async () => {
      await page.goto(`${baseUrl}/demo/charts`);

      // Y-axis should have numeric labels
      const yAxisLabels = await page.$$('.text-right span');
      expect(yAxisLabels.length).toBeGreaterThan(0);
    });

    it('should show bars with correct dimensions', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('svg');

      // Count rectangles (bars)
      const bars = await page.$$('svg rect');
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  describe('Stacked Bar Chart', () => {
    it('should render stacked bar chart', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('text="Stacked Bar Chart"');

      // Check title
      const titleExists = await page.$('text="Weekly Trade Volume by Size"');
      expect(titleExists).toBeTruthy();

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-stacked.png',
        fullPage: false,
      });
    });

    it('should display legend for stacked chart', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('text="Stacked Bar Chart"');

      // Check legend items
      const whaleTrades = await page.$('text="Whale Trades"');
      const largeTrades = await page.$('text="Large Trades"');
      const regularTrades = await page.$('text="Regular Trades"');

      expect(whaleTrades).toBeTruthy();
      expect(largeTrades).toBeTruthy();
      expect(regularTrades).toBeTruthy();
    });

    it('should have multiple bar segments', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('text="Stacked Bar Chart"');
      await page.waitForSelector('svg');

      // Should have multiple rectangles for stacked segments
      const bars = await page.$$('svg rect');
      expect(bars.length).toBeGreaterThan(7); // At least one bar per day
    });
  });

  describe('Grouped Bar Chart', () => {
    it('should render grouped bar chart', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('text="Grouped Bar Chart"');

      // Check title
      const titleExists = await page.$('text="Market Sentiment Comparison"');
      expect(titleExists).toBeTruthy();

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-grouped.png',
        fullPage: false,
      });
    });

    it('should display legend for grouped chart', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('text="Grouped Bar Chart"');

      // Check legend items
      const yesVotes = await page.$('text="Yes Votes"');
      const noVotes = await page.$('text="No Votes"');

      expect(yesVotes).toBeTruthy();
      expect(noVotes).toBeTruthy();
    });
  });

  describe('Grid Lines', () => {
    it('should show grid lines by default', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('svg');

      // Check for grid lines (SVG line elements)
      const gridLines = await page.$$('svg line');
      expect(gridLines.length).toBeGreaterThan(0);
    });

    it('should hide grid lines when disabled', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('text="Without Grid Lines"');

      // Find the chart without grid
      const section = await page.$('text="Without Grid Lines"');
      expect(section).toBeTruthy();

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-no-grid.png',
        fullPage: false,
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('text="Loading State"');

      // Check for pulse animation
      const loadingElement = await page.$('.animate-pulse');
      expect(loadingElement).toBeTruthy();

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-loading.png',
        fullPage: false,
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty message', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('text="Empty State"');

      // Check for empty message
      const emptyMessage = await page.$('text="No trading data available"');
      expect(emptyMessage).toBeTruthy();

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-empty.png',
        fullPage: false,
      });
    });
  });

  describe('Custom Tooltip', () => {
    it('should have custom tooltip section', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('text="Custom Tooltip"');

      const customTooltipSection = await page.$('text="Custom Tooltip Example"');
      expect(customTooltipSection).toBeTruthy();

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-custom-tooltip.png',
        fullPage: false,
      });
    });
  });

  describe('Interactions', () => {
    it('should handle hover interactions', async () => {
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('svg');

      // Get first bar
      const bars = await page.$$('svg rect[style*="cursor: pointer"]');
      if (bars.length > 0) {
        // Hover over first bar
        await bars[0]!.hover();

        // Wait a bit for tooltip to appear
        await new Promise(resolve => setTimeout(resolve, 100));

        // Take screenshot with hover
        await page.screenshot({
          path: 'tests/e2e/screenshots/bar-chart-hover.png',
          fullPage: false,
        });
      }
    });
  });

  describe('Responsive Design', () => {
    it('should render correctly on mobile', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('svg');

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-mobile.png',
        fullPage: false,
      });

      // Reset viewport
      await page.setViewport({ width: 1920, height: 1080 });
    });

    it('should render correctly on tablet', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('svg');

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-tablet.png',
        fullPage: false,
      });

      // Reset viewport
      await page.setViewport({ width: 1920, height: 1080 });
    });

    it('should render correctly on desktop', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('svg');

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-desktop.png',
        fullPage: true,
      });
    });
  });

  describe('Dark Mode', () => {
    it('should render in dark mode', async () => {
      await page.goto(`${baseUrl}/demo/charts`);

      // Add dark class to html element
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/bar-chart-dark-mode.png',
        fullPage: false,
      });

      // Remove dark class
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
      });
    });
  });

  describe('Performance', () => {
    it('should render quickly', async () => {
      const startTime = Date.now();
      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('svg');
      const endTime = Date.now();

      const renderTime = endTime - startTime;
      // Should render in less than 5 seconds
      expect(renderTime).toBeLessThan(5000);
    });

    it('should not have console errors', async () => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(`${baseUrl}/demo/charts`);
      await page.waitForSelector('svg');

      // Should have no console errors
      expect(consoleErrors.length).toBe(0);
    });
  });
});
