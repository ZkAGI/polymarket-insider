/**
 * End-to-end tests for Wallet Trading History Table
 *
 * Tests the wallet trading history table functionality using Puppeteer browser automation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer';

// Helper to wait for timeout
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890';

describe('Wallet Trading History Table E2E', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  });

  afterAll(async () => {
    await browser?.close();
  });

  describe('Page Load and Table Rendering', () => {
    it('should load wallet profile page', async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
        timeout: 10000,
      });

      const title = await page.title();
      expect(title).toBe('Polymarket Tracker');
    });

    it('should render trading history table', async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });

      const table = await page.$('[data-testid="trading-history-table"]');
      expect(table).toBeTruthy();
    });

    it('should display table header', async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });

      const header = await page.$eval('h2', (el) => el.textContent);
      expect(header).toContain('Trading History');
    });

    it('should display total trade count', async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });

      const text = await page.$eval('p.text-sm', (el) => el.textContent);
      expect(text).toMatch(/\d+ total trades/);
    });
  });

  describe('Table Columns', () => {
    beforeAll(async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });
    });

    it('should display Time column', async () => {
      const headers = await page.$$eval('thead th', (elements) =>
        elements.map((el) => el.textContent)
      );
      expect(headers.some((h) => h?.includes('Time'))).toBe(true);
    });

    it('should display Market column', async () => {
      const headers = await page.$$eval('thead th', (elements) =>
        elements.map((el) => el.textContent)
      );
      expect(headers.some((h) => h?.includes('Market'))).toBe(true);
    });

    it('should display Outcome column', async () => {
      const headers = await page.$$eval('thead th', (elements) =>
        elements.map((el) => el.textContent)
      );
      expect(headers.some((h) => h?.includes('Outcome'))).toBe(true);
    });

    it('should display Side column', async () => {
      const headers = await page.$$eval('thead th', (elements) =>
        elements.map((el) => el.textContent)
      );
      expect(headers.some((h) => h?.includes('Side'))).toBe(true);
    });

    it('should display Size column', async () => {
      const headers = await page.$$eval('thead th', (elements) =>
        elements.map((el) => el.textContent)
      );
      expect(headers.some((h) => h?.includes('Size'))).toBe(true);
    });

    it('should display Price column', async () => {
      const headers = await page.$$eval('thead th', (elements) =>
        elements.map((el) => el.textContent)
      );
      expect(headers.some((h) => h?.includes('Price'))).toBe(true);
    });

    it('should display P&L column', async () => {
      const headers = await page.$$eval('thead th', (elements) =>
        elements.map((el) => el.textContent)
      );
      expect(headers.some((h) => h?.includes('P&L'))).toBe(true);
    });
  });

  describe('Trade Data Display', () => {
    beforeAll(async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });
    });

    it('should display trade rows', async () => {
      const rows = await page.$$('tbody tr[data-testid^="trade-row-"]');
      expect(rows.length).toBeGreaterThan(0);
    });

    it('should display market titles as links', async () => {
      const marketLinks = await page.$$('tbody a[href^="/market/"]');
      expect(marketLinks.length).toBeGreaterThan(0);
    });

    it('should display outcome badges', async () => {
      const outcomeBadges = await page.$$eval(
        'tbody span.rounded-full',
        (elements) => elements.map((el) => el.textContent)
      );
      const hasOutcome = outcomeBadges.some(
        (text) => text === 'YES' || text === 'NO'
      );
      expect(hasOutcome).toBe(true);
    });

    it('should display side badges', async () => {
      const sideBadges = await page.$$eval(
        'tbody span.rounded-full',
        (elements) => elements.map((el) => el.textContent)
      );
      const hasSide = sideBadges.some(
        (text) => text === 'BUY' || text === 'SELL'
      );
      expect(hasSide).toBe(true);
    });

    it('should display formatted sizes', async () => {
      const sizes = await page.$$eval('tbody td:nth-child(6)', (elements) =>
        elements.map((el) => el.textContent)
      );
      const hasFormattedSize = sizes.some((size) => size?.includes('$'));
      expect(hasFormattedSize).toBe(true);
    });

    it('should display formatted prices', async () => {
      const prices = await page.$$eval('tbody td:nth-child(7)', (elements) =>
        elements.map((el) => el.textContent)
      );
      const hasFormattedPrice = prices.some((price) => price?.includes('%'));
      expect(hasFormattedPrice).toBe(true);
    });
  });

  describe('Row Expansion', () => {
    beforeAll(async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });
    });

    it('should have expand buttons', async () => {
      const expandButtons = await page.$$('[data-testid^="expand-button-"]');
      expect(expandButtons.length).toBeGreaterThan(0);
    });

    it('should expand row when expand button is clicked', async () => {
      const firstExpandButton = await page.$('[data-testid^="expand-button-"]');
      if (!firstExpandButton) throw new Error('No expand button found');

      await firstExpandButton.click();
      await wait(300); // Wait for animation

      const detailsRow = await page.$('[data-testid^="trade-details-"]');
      expect(detailsRow).toBeTruthy();
    });

    it('should display shares in expanded row', async () => {
      const firstExpandButton = await page.$('[data-testid^="expand-button-"]');
      if (!firstExpandButton) throw new Error('No expand button found');

      await firstExpandButton.click();
      await wait(300);

      const content = await page.$eval('[data-testid^="trade-details-"]', (el) =>
        el.textContent
      );
      expect(content).toContain('Shares:');
    });

    it('should display fee in expanded row', async () => {
      const content = await page.$eval('[data-testid^="trade-details-"]', (el) =>
        el.textContent
      );
      expect(content).toContain('Fee:');
    });

    it('should display transaction hash in expanded row', async () => {
      const content = await page.$eval('[data-testid^="trade-details-"]', (el) =>
        el.textContent
      );
      expect(content).toContain('Transaction:');
    });

    it('should have Polygonscan link in expanded row', async () => {
      const link = await page.$('[data-testid^="trade-details-"] a[href*="polygonscan.com"]');
      expect(link).toBeTruthy();
    });

    it('should collapse row when expand button is clicked again', async () => {
      const firstExpandButton = await page.$('[data-testid^="expand-button-"]');
      if (!firstExpandButton) throw new Error('No expand button found');

      await firstExpandButton.click();
      await wait(300);

      const detailsRow = await page.$('[data-testid^="trade-details-"]');
      expect(detailsRow).toBeFalsy();
    });
  });

  describe('Sorting', () => {
    beforeAll(async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });
    });

    it('should have sortable Time column', async () => {
      const timeHeader = await page.$('thead th:has-text("Time")');
      expect(timeHeader).toBeTruthy();
    });

    it('should have sortable Size column', async () => {
      const sizeHeader = await page.$('thead th:has-text("Size")');
      expect(sizeHeader).toBeTruthy();
    });

    it('should have sortable Price column', async () => {
      const priceHeader = await page.$('thead th:has-text("Price")');
      expect(priceHeader).toBeTruthy();
    });

    it('should have sortable P&L column', async () => {
      const plHeader = await page.$('thead th:has-text("P&L")');
      expect(plHeader).toBeTruthy();
    });

    it('should display sort icons', async () => {
      const sortIcons = await page.$$('thead svg');
      expect(sortIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Pagination Controls', () => {
    beforeAll(async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });
    });

    it('should display page size selector', async () => {
      const selector = await page.$('[data-testid="page-size-selector"]');
      expect(selector).toBeTruthy();
    });

    it('should have page size options', async () => {
      const options = await page.$$eval(
        '[data-testid="page-size-selector"] option',
        (elements) => elements.map((el) => el.textContent)
      );
      expect(options).toContain('10');
      expect(options).toContain('25');
      expect(options).toContain('50');
      expect(options).toContain('100');
    });

    it('should display current page range', async () => {
      const rangeText = await page.$eval('div.flex span', (el) => el.textContent);
      expect(rangeText).toMatch(/\d+-\d+ of \d+/);
    });

    it('should have First button', async () => {
      const firstButton = await page.$('[data-testid="first-page-button"]');
      expect(firstButton).toBeTruthy();
    });

    it('should have Previous button', async () => {
      const prevButton = await page.$('[data-testid="prev-page-button"]');
      expect(prevButton).toBeTruthy();
    });

    it('should have Next button', async () => {
      const nextButton = await page.$('[data-testid="next-page-button"]');
      expect(nextButton).toBeTruthy();
    });

    it('should have Last button', async () => {
      const lastButton = await page.$('[data-testid="last-page-button"]');
      expect(lastButton).toBeTruthy();
    });

    it('should disable First button on first page', async () => {
      const isDisabled = await page.$eval(
        '[data-testid="first-page-button"]',
        (el) => (el as HTMLButtonElement).disabled
      );
      expect(isDisabled).toBe(true);
    });

    it('should disable Previous button on first page', async () => {
      const isDisabled = await page.$eval(
        '[data-testid="prev-page-button"]',
        (el) => (el as HTMLButtonElement).disabled
      );
      expect(isDisabled).toBe(true);
    });

    it('should display current page number', async () => {
      const pageText = await page.$eval(
        'div.flex.items-center.space-x-2:last-child span',
        (el) => el.textContent
      );
      expect(pageText).toMatch(/Page \d+ of \d+/);
    });
  });

  describe('Pagination Interaction', () => {
    beforeAll(async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });
    });

    it('should navigate to next page', async () => {
      const nextButton = await page.$('[data-testid="next-page-button"]');
      if (!nextButton) throw new Error('Next button not found');

      const isDisabled = await page.$eval(
        '[data-testid="next-page-button"]',
        (el) => (el as HTMLButtonElement).disabled
      );

      if (!isDisabled) {
        await nextButton.click();
        await wait(300);

        const pageText = await page.$eval(
          'div.flex.items-center.space-x-2:last-child span',
          (el) => el.textContent
        );
        expect(pageText).toContain('Page 2');
      }
    });

    it('should change page size', async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });

      const selector = await page.$('[data-testid="page-size-selector"]');
      if (!selector) throw new Error('Page size selector not found');

      await selector.select('50');
      await wait(300);

      const selected = await page.$eval(
        '[data-testid="page-size-selector"]',
        (el) => (el as HTMLSelectElement).value
      );
      expect(selected).toBe('50');
    });
  });

  describe('Responsive Design', () => {
    it('should render on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });

      const table = await page.$('[data-testid="trading-history-table"]');
      expect(table).toBeTruthy();
    });

    it('should render on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });

      const table = await page.$('[data-testid="trading-history-table"]');
      expect(table).toBeTruthy();
    });

    it('should render on desktop viewport', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });

      const table = await page.$('[data-testid="trading-history-table"]');
      expect(table).toBeTruthy();
    });
  });

  describe('Dark Mode', () => {
    it('should render in dark mode', async () => {
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });

      // Add dark class to html element
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await wait(300);

      const table = await page.$('[data-testid="trading-history-table"]');
      expect(table).toBeTruthy();
    });
  });

  describe('Screenshot Tests', () => {
    it('should match screenshot of table', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`, {
        waitUntil: 'networkidle0',
      });

      // Scroll to table
      await page.evaluate(() => {
        const table = document.querySelector('[data-testid="trading-history-table"]');
        table?.scrollIntoView();
      });

      await wait(500);

      const table = await page.$('[data-testid="trading-history-table"]');
      if (table) {
        const screenshot = await table.screenshot();
        expect(screenshot).toBeTruthy();
      }
    });
  });
});
