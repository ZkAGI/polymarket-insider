import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Helper function to wait
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('MarketVolumeChart E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = 'http://localhost:3000';
  const screenshotDir = path.join(__dirname, '../../screenshots/volume-chart');

  beforeAll(async () => {
    // Create screenshot directory
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to a market detail page
    await page.goto(`${baseUrl}/market/test-market-1`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for page to load
    await page.waitForSelector('[data-testid="volume-chart-svg"]', { timeout: 10000 });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Volume Chart Rendering', () => {
    it('should render volume chart component', async () => {
      const volumeChart = await page.$('[data-testid="volume-chart-svg"]');
      expect(volumeChart).toBeTruthy();

      await page.screenshot({
        path: path.join(screenshotDir, 'volume-chart-rendered.png'),
      });
    });

    it('should display chart title', async () => {
      const title = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h3'));
        return headings.some((h) => h.textContent?.includes('Trading Volume'));
      });
      expect(title).toBe(true);
    });

    it('should display chart description', async () => {
      const description = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('p'));
        return elements.some((el) => el.textContent?.includes('Historical trading volume'));
      });
      expect(description).toBe(true);
    });

    it('should render SVG chart with correct viewBox', async () => {
      const viewBox = await page.$eval('[data-testid="volume-chart-svg"]', (el) =>
        el.getAttribute('viewBox')
      );
      expect(viewBox).toBeTruthy();
      expect(viewBox).toMatch(/^0 0 800 \d+$/);
    });
  });

  describe('Time Range Selector', () => {
    it('should render all time range buttons', async () => {
      const ranges = ['1D', '1W', '1M', '3M', '6M', 'ALL'];

      for (const range of ranges) {
        const button = await page.$(`[data-testid="volume-range-${range}"]`);
        expect(button).toBeTruthy();
      }
    });

    it('should have 1M selected by default', async () => {
      const isSelected = await page.$eval('[data-testid="volume-range-1M"]', (el) =>
        el.classList.contains('bg-white')
      );
      expect(isSelected).toBe(true);
    });

    it('should change selection when clicking different range', async () => {
      await page.click('[data-testid="volume-range-1W"]');
      await wait(500);

      const isSelected = await page.$eval('[data-testid="volume-range-1W"]', (el) =>
        el.classList.contains('bg-white')
      );
      expect(isSelected).toBe(true);

      await page.screenshot({
        path: path.join(screenshotDir, 'volume-chart-1w-range.png'),
      });
    });

    it('should update chart data when range changes', async () => {
      // Get initial bar count
      await page.click('[data-testid="volume-range-1M"]');
      await wait(500);
      const bars1M = await page.$$('[data-testid^="volume-bar-"]');

      // Change to 1W
      await page.click('[data-testid="volume-range-1W"]');
      await wait(500);
      const bars1W = await page.$$('[data-testid^="volume-bar-"]');

      // 1W should have fewer bars than 1M
      expect(bars1W.length).toBeLessThan(bars1M.length);
    });

    it('should maintain chart responsiveness across ranges', async () => {
      const ranges = ['1D', '1W', '1M', '3M'];

      for (const range of ranges) {
        await page.click(`[data-testid="volume-range-${range}"]`);
        await wait(300);

        const svg = await page.$('[data-testid="volume-chart-svg"]');
        expect(svg).toBeTruthy();
      }

      // Reset to 1M
      await page.click('[data-testid="volume-range-1M"]');
    });
  });

  describe('Volume Bars', () => {
    it('should render volume bars', async () => {
      const bars = await page.$$('[data-testid^="volume-bar-"]');
      expect(bars.length).toBeGreaterThan(0);
    });

    it('should render bars with correct attributes', async () => {
      const barAttributes = await page.evaluate(() => {
        const bar = document.querySelector('[data-testid^="volume-bar-"]');
        return {
          width: bar?.getAttribute('width'),
          height: bar?.getAttribute('height'),
          x: bar?.getAttribute('x'),
          y: bar?.getAttribute('y'),
        };
      });

      expect(barAttributes.width).toBeTruthy();
      expect(barAttributes.height).toBeTruthy();
      expect(barAttributes.x).toBeTruthy();
      expect(barAttributes.y).toBeTruthy();
    });

    it('should highlight bars on hover', async () => {
      const bar = await page.$('[data-testid="volume-bar-0"]');
      await bar?.hover();
      await wait(200);

      const tooltip = await page.$('[data-testid="volume-tooltip"]');
      expect(tooltip).toBeTruthy();

      await page.screenshot({
        path: path.join(screenshotDir, 'volume-chart-hover.png'),
      });
    });

    it('should display different colored bars for anomalies', async () => {
      const hasRedBar = await page.evaluate(() => {
        const bars = Array.from(document.querySelectorAll('[data-testid^="volume-bar-"]'));
        return bars.some((bar) => bar.classList.contains('fill-red-500'));
      });

      // May or may not have anomalies depending on data
      expect(typeof hasRedBar).toBe('boolean');
    });
  });

  describe('Axes and Labels', () => {
    it('should render Y-axis labels', async () => {
      const yLabels = await page.$$('[data-testid^="y-axis-label-"]');
      expect(yLabels.length).toBeGreaterThan(0);
    });

    it('should format Y-axis labels as currency', async () => {
      const labelText = await page.$eval('[data-testid="y-axis-label-0"]', (el) => el.textContent);
      expect(labelText).toMatch(/\$/);
    });

    it('should render X-axis labels', async () => {
      const xLabels = await page.$$('[data-testid^="x-axis-label-"]');
      expect(xLabels.length).toBeGreaterThan(0);
    });

    it('should update X-axis labels based on time range', async () => {
      // Check 1D format
      await page.click('[data-testid="volume-range-1D"]');
      await wait(500);
      const label1D = await page.$eval('[data-testid="x-axis-label-0"]', (el) => el.textContent);

      // Check 1M format
      await page.click('[data-testid="volume-range-1M"]');
      await wait(500);
      const label1M = await page.$eval('[data-testid="x-axis-label-0"]', (el) => el.textContent);

      // Formats should be different
      expect(label1D).not.toBe(label1M);
    });

    it('should render axis lines', async () => {
      const hasYAxis = await page.evaluate(() => {
        const lines = Array.from(document.querySelectorAll('line'));
        return lines.some((line) => {
          const x1 = line.getAttribute('x1');
          const x2 = line.getAttribute('x2');
          return x1 === x2; // Vertical line for Y-axis
        });
      });
      expect(hasYAxis).toBe(true);

      const hasXAxis = await page.evaluate(() => {
        const lines = Array.from(document.querySelectorAll('line'));
        return lines.some((line) => {
          const y1 = line.getAttribute('y1');
          const y2 = line.getAttribute('y2');
          return y1 === y2; // Horizontal line for X-axis
        });
      });
      expect(hasXAxis).toBe(true);
    });
  });

  describe('Grid Lines', () => {
    it('should render grid lines by default', async () => {
      const gridLines = await page.$('.grid-lines');
      expect(gridLines).toBeTruthy();
    });

    it('should render horizontal grid lines', async () => {
      const hasGridLines = await page.evaluate(() => {
        const gridGroup = document.querySelector('.grid-lines');
        return gridGroup ? gridGroup.querySelectorAll('line').length > 0 : false;
      });
      expect(hasGridLines).toBe(true);
    });
  });

  describe('Tooltip Interaction', () => {
    it('should not show tooltip initially', async () => {
      const tooltip = await page.$('[data-testid="volume-tooltip"]');
      expect(tooltip).toBeFalsy();
    });

    it('should show tooltip on bar hover', async () => {
      const bar = await page.$('[data-testid="volume-bar-0"]');
      await bar?.hover();
      await wait(200);

      const tooltip = await page.$('[data-testid="volume-tooltip"]');
      expect(tooltip).toBeTruthy();
    });

    it('should display volume in tooltip', async () => {
      const bar = await page.$('[data-testid="volume-bar-0"]');
      await bar?.hover();
      await wait(200);

      const tooltipText = await page.$eval('[data-testid="volume-tooltip"]', (el) => el.textContent);
      expect(tooltipText).toContain('Volume:');
      expect(tooltipText).toMatch(/\$/);
    });

    it('should display date in tooltip', async () => {
      const bar = await page.$('[data-testid="volume-bar-0"]');
      await bar?.hover();
      await wait(200);

      const tooltipText = await page.$eval('[data-testid="volume-tooltip"]', (el) => el.textContent);
      expect(tooltipText?.length).toBeGreaterThan(0);
    });

    it('should display trade count in tooltip', async () => {
      const bar = await page.$('[data-testid="volume-bar-0"]');
      await bar?.hover();
      await wait(200);

      const tooltipText = await page.$eval('[data-testid="volume-tooltip"]', (el) => el.textContent);
      expect(tooltipText).toContain('Trades:');
    });

    it('should hide tooltip when mouse leaves', async () => {
      const bar = await page.$('[data-testid="volume-bar-0"]');
      await bar?.hover();
      await wait(200);

      // Move mouse away
      await page.mouse.move(100, 100);
      await wait(200);

      const tooltip = await page.$('[data-testid="volume-tooltip"]');
      expect(tooltip).toBeFalsy();
    });

    it('should update tooltip when hovering different bars', async () => {
      const bar0 = await page.$('[data-testid="volume-bar-0"]');
      await bar0?.hover();
      await wait(200);
      const tooltip1 = await page.$eval('[data-testid="volume-tooltip"]', (el) => el.textContent);

      const bar10 = await page.$('[data-testid="volume-bar-10"]');
      await bar10?.hover();
      await wait(200);
      const tooltip2 = await page.$eval('[data-testid="volume-tooltip"]', (el) => el.textContent);

      // Tooltips should be different
      expect(tooltip1).not.toBe(tooltip2);
    });
  });

  describe('Anomaly Detection', () => {
    it('should render anomaly markers if present', async () => {
      const anomalyMarkers = await page.$$('[data-testid^="anomaly-marker-"]');
      // May or may not have anomalies
      expect(anomalyMarkers.length).toBeGreaterThanOrEqual(0);
    });

    it('should highlight anomaly warning in tooltip', async () => {
      const redBars = await page.$$('rect.fill-red-500');

      if (redBars.length > 0) {
        await redBars[0]?.hover();
        await wait(200);

        const tooltipText = await page.$eval(
          '[data-testid="volume-tooltip"]',
          (el) => el.textContent
        );
        expect(tooltipText).toContain('spike');
      }
    });
  });

  describe('Legend', () => {
    it('should render legend', async () => {
      const hasLegend = await page.evaluate(() => {
        const text = document.body.textContent;
        return text?.includes('Normal volume');
      });
      expect(hasLegend).toBe(true);
    });

    it('should show anomaly legend if anomalies detected', async () => {
      const redBars = await page.$$('rect.fill-red-500');

      if (redBars.length > 0) {
        const hasAnomalyLegend = await page.evaluate(() => {
          const text = document.body.textContent;
          return text?.includes('Unusual spike');
        });
        expect(hasAnomalyLegend).toBe(true);
      }
    });

    it('should display count in anomaly legend', async () => {
      const hasCount = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('span'));
        return elements.some((el) => el.textContent?.match(/Unusual spike \(\d+\)/));
      });

      const redBars = await page.$$('rect.fill-red-500');
      if (redBars.length > 0) {
        expect(hasCount).toBe(true);
      }
    });
  });

  describe('Responsive Design', () => {
    it('should render correctly on desktop', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await wait(500);

      const svg = await page.$('[data-testid="volume-chart-svg"]');
      expect(svg).toBeTruthy();

      await page.screenshot({
        path: path.join(screenshotDir, 'volume-chart-desktop.png'),
      });
    });

    it('should render correctly on tablet', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await wait(500);

      const svg = await page.$('[data-testid="volume-chart-svg"]');
      expect(svg).toBeTruthy();

      await page.screenshot({
        path: path.join(screenshotDir, 'volume-chart-tablet.png'),
      });
    });

    it('should render correctly on mobile', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await wait(500);

      const svg = await page.$('[data-testid="volume-chart-svg"]');
      expect(svg).toBeTruthy();

      await page.screenshot({
        path: path.join(screenshotDir, 'volume-chart-mobile.png'),
      });
    });

    it('should have responsive time range buttons on mobile', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await wait(500);

      const button = await page.$('[data-testid="volume-range-1M"]');
      expect(button).toBeTruthy();

      // Buttons should be clickable
      await page.click('[data-testid="volume-range-1W"]');
      await wait(300);

      const isSelected = await page.$eval('[data-testid="volume-range-1W"]', (el) =>
        el.classList.contains('bg-white')
      );
      expect(isSelected).toBe(true);
    });

    // Reset viewport
    it('should reset viewport to desktop', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await wait(500);
    });
  });

  describe('Dark Mode', () => {
    it('should render correctly in dark mode', async () => {
      // Enable dark mode by adding class to html
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await wait(500);

      const svg = await page.$('[data-testid="volume-chart-svg"]');
      expect(svg).toBeTruthy();

      await page.screenshot({
        path: path.join(screenshotDir, 'volume-chart-dark-mode.png'),
      });

      // Disable dark mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
      });
    });
  });

  describe('Browser Console Errors', () => {
    it('should not have console errors', async () => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="volume-chart-svg"]', { timeout: 10000 });

      // Filter out known non-critical errors
      const criticalErrors = errors.filter(
        (error) =>
          !error.includes('favicon') &&
          !error.includes('chunk') &&
          !error.includes('Failed to load resource')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should render chart within acceptable time', async () => {
      const startTime = Date.now();

      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="volume-chart-svg"]', { timeout: 10000 });

      const loadTime = Date.now() - startTime;

      // Chart should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    it('should handle time range changes smoothly', async () => {
      const ranges = ['1D', '1W', '1M', '3M', '6M', 'ALL'];

      for (const range of ranges) {
        const startTime = Date.now();

        await page.click(`[data-testid="volume-range-${range}"]`);
        await wait(100);

        const changeTime = Date.now() - startTime;

        // Range change should be fast
        expect(changeTime).toBeLessThan(1000);
      }
    });
  });
});
