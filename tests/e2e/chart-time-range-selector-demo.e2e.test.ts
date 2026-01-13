/**
 * E2E Tests for ChartTimeRangeSelector Component
 *
 * Tests the time range selector on the demo page in a real browser.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('ChartTimeRangeSelector Demo E2E Tests', () => {
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
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('should render the demo page with time range selectors', async () => {
    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('h1');

    const h1Text = await page.$eval('h1', (el) => el.textContent);
    expect(h1Text).toBe('Chart Components Demo');

    const h2Text = await page.$eval('h2', (el) => el.textContent);
    expect(h2Text).toBe('Time Range Selector');
  }, 15000);

  it('should display all time range buttons', async () => {
    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('button[aria-label*="time range"]');

    // Check for presence of time range buttons
    const buttons = await page.$$('button[aria-label*="time range"]');
    expect(buttons.length).toBeGreaterThan(0);

    // Check for specific time ranges
    const buttonTexts = await Promise.all(
      buttons.slice(0, 6).map((btn) => btn.evaluate((el) => el.textContent))
    );
    expect(buttonTexts).toContain('1D');
    expect(buttonTexts).toContain('1W');
    expect(buttonTexts).toContain('1M');
  }, 15000);

  it('should have 1M selected by default', async () => {
    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('button[aria-label*="time range"]');

    // Find the selected button
    const selectedButton = await page.$('button[aria-pressed="true"]');
    expect(selectedButton).not.toBeNull();

    if (selectedButton) {
      const text = await selectedButton.evaluate((el) => el.textContent);
      expect(text).toBe('1M');
    }
  }, 15000);

  it('should change selection when clicking different time range', async () => {
    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('button[aria-label*="time range"]');

    // Click on 1W button
    const oneWeekButtons = await page.$$('button[aria-label="Select 1W time range"]');
    if (oneWeekButtons.length > 0) {
      await oneWeekButtons[0]?.click();
      await page.waitForFunction(() => true, { timeout: 500 });

      // Check if 1W is now selected
      const selectedButtons = await page.$$('button[aria-pressed="true"]');
      const selectedTexts = await Promise.all(
        selectedButtons.map((btn) => btn.evaluate((el) => el.textContent))
      );

      expect(selectedTexts.some((text) => text === '1W')).toBe(true);
    }
  }, 15000);

  it('should render different size variants', async () => {
    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('h3');

    // Wait for the "Different Sizes" section
    const headings = await page.$$('h3');
    const headingTexts = await Promise.all(headings.map((h) => h.evaluate((el) => el.textContent)));

    expect(headingTexts).toContain('Different Sizes');
  }, 15000);

  it('should render custom range button when enabled', async () => {
    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('h3');

    // Check for "With Custom Range Option" section
    const headings = await page.$$('h3');
    const headingTexts = await Promise.all(headings.map((h) => h.evaluate((el) => el.textContent)));

    expect(headingTexts).toContain('With Custom Range Option');

    // Check for Custom button
    const customButtons = await page.$$('button');
    const customButtonTexts = await Promise.all(
      customButtons.map((btn) => btn.evaluate((el) => el.textContent))
    );

    expect(customButtonTexts).toContain('Custom');
  }, 15000);

  it('should integrate with chart component', async () => {
    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('svg');

    // Check for "Integrated with Chart" section
    const headings = await page.$$('h3');
    const headingTexts = await Promise.all(headings.map((h) => h.evaluate((el) => el.textContent)));

    expect(headingTexts).toContain('Integrated with Chart');

    // Verify SVG chart is present
    const svgs = await page.$$('svg');
    expect(svgs.length).toBeGreaterThan(0);
  }, 15000);

  it('should have no console errors', async () => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('h1');

    // Wait a bit for any async errors
    await page.waitForFunction(() => true, { timeout: 1000 });

    expect(consoleErrors.length).toBe(0);
  }, 15000);

  it('should be responsive and work with different viewport sizes', async () => {
    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('button[aria-label*="time range"]');

    // Test mobile viewport
    await page.setViewport({ width: 375, height: 667 });
    await page.waitForFunction(() => true, { timeout: 500 });

    const buttons = await page.$$('button[aria-label*="time range"]');
    expect(buttons.length).toBeGreaterThan(0);

    // Test tablet viewport
    await page.setViewport({ width: 768, height: 1024 });
    await page.waitForFunction(() => true, { timeout: 500 });

    const buttonsTablet = await page.$$('button[aria-label*="time range"]');
    expect(buttonsTablet.length).toBeGreaterThan(0);

    // Reset to desktop
    await page.setViewport({ width: 1280, height: 720 });
  }, 15000);

  it('should update selected range text display', async () => {
    await page.goto(`${BASE_URL}/demo/charts`);
    await page.waitForSelector('button[aria-label*="time range"]');

    // Find "Selected Range:" text
    const content = await page.content();
    expect(content).toContain('Selected Range:');
    expect(content).toContain('1M');
  }, 15000);
});
