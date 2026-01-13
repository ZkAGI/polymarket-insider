/**
 * E2E tests for Market Detail Page
 * Tests the market detail page using Puppeteer browser automation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_MARKET_ID = 'test-market-abc123';

describe('Market Detail Page E2E Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  it('loads market detail page successfully', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
      timeout: 10000,
    });

    // Wait for main content to load
    await page.waitForSelector('h1', { timeout: 5000 });

    const title = await page.title();
    expect(title).toBeTruthy();
  }, 15000);

  it('displays market question', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const question = await page.$eval('h1', (el) => el.textContent);
    expect(question).toBeTruthy();
    expect(question?.length).toBeGreaterThan(0);
  }, 15000);

  it('displays status badge', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    // Look for status badge (Active, Closed, or Inactive)
    const statusBadge = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('span'));
      return badges.some(
        (badge) =>
          badge.textContent?.includes('Active') ||
          badge.textContent?.includes('Closed') ||
          badge.textContent?.includes('Inactive')
      );
    });

    expect(statusBadge).toBe(true);
  }, 15000);

  it('displays category badge', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    // Check for category badge
    const hasCategoryBadge = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('span'));
      const categories = [
        'Politics',
        'Crypto',
        'Finance',
        'Technology',
        'Entertainment',
        'Science',
        'Geopolitics',
        'Sports',
        'Other',
      ];
      return badges.some((badge) =>
        categories.some((cat) => badge.textContent?.toLowerCase().includes(cat.toLowerCase()))
      );
    });

    expect(hasCategoryBadge).toBe(true);
  }, 15000);

  it('displays volume information', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasVolume = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Volume') && (text.includes('$') || text.includes('K') || text.includes('M'));
    });

    expect(hasVolume).toBe(true);
  }, 15000);

  it('displays current odds section', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasOddsSection = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2'));
      return headings.some((h) => h.textContent?.includes('Current Odds'));
    });

    expect(hasOddsSection).toBe(true);
  }, 15000);

  it('displays market outcomes with probabilities', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasProbabilities = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('%') && text.includes('$');
    });

    expect(hasProbabilities).toBe(true);
  }, 15000);

  it('displays market info section', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasInfoSection = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2'));
      return headings.some((h) => h.textContent?.includes('Market Information'));
    });

    expect(hasInfoSection).toBe(true);
  }, 15000);

  it('displays Polymarket link', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasPolymarketLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.some(
        (link) =>
          link.textContent?.includes('View on Polymarket') &&
          link.getAttribute('href')?.includes('polymarket.com')
      );
    });

    expect(hasPolymarketLink).toBe(true);
  }, 15000);

  it('Polymarket link opens in new tab', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const linkAttributes = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const polymarketLink = links.find((link) => link.textContent?.includes('View on Polymarket'));
      return {
        target: polymarketLink?.getAttribute('target'),
        rel: polymarketLink?.getAttribute('rel'),
      };
    });

    expect(linkAttributes.target).toBe('_blank');
    expect(linkAttributes.rel).toBe('noopener noreferrer');
  }, 15000);

  it('displays back to dashboard link', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasBackLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.some(
        (link) =>
          link.textContent?.includes('Back to Dashboard') &&
          link.getAttribute('href')?.includes('/dashboard')
      );
    });

    expect(hasBackLink).toBe(true);
  }, 15000);

  it('displays copy market ID button', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasCopyIdButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some((button) => button.textContent?.includes('Copy Market ID'));
    });

    expect(hasCopyIdButton).toBe(true);
  }, 15000);

  it('displays share market button', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasShareButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some((button) => button.textContent?.includes('Share Market'));
    });

    expect(hasShareButton).toBe(true);
  }, 15000);

  it('displays probability bars for outcomes', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasProbabilityBars = await page.evaluate(() => {
      const bars = Array.from(document.querySelectorAll('.bg-blue-600'));
      return bars.length > 0;
    });

    expect(hasProbabilityBars).toBe(true);
  }, 15000);

  it('displays market description', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    // Look for description text in a paragraph
    const hasDescription = await page.evaluate(() => {
      const paragraphs = Array.from(document.querySelectorAll('p'));
      return paragraphs.some((p) => (p.textContent?.length ?? 0) > 20);
    });

    expect(hasDescription).toBe(true);
  }, 15000);

  it('displays market ID', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const hasMarketId = await page.evaluate(() => {
      const codeElements = Array.from(document.querySelectorAll('code'));
      return codeElements.length > 0 && codeElements.some((code) => (code.textContent?.length ?? 0) > 5);
    });

    expect(hasMarketId).toBe(true);
  }, 15000);

  it('page is responsive on mobile viewport', async () => {
    await page.setViewport({ width: 375, height: 667 }); // iPhone SE
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const isResponsive = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth <= window.innerWidth + 1; // Allow 1px tolerance
    });

    expect(isResponsive).toBe(true);
  }, 15000);

  it('page is responsive on tablet viewport', async () => {
    await page.setViewport({ width: 768, height: 1024 }); // iPad
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    const isResponsive = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth <= window.innerWidth + 1; // Allow 1px tolerance
    });

    expect(isResponsive).toBe(true);
  }, 15000);

  it('supports dark mode', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    // Check if dark mode classes are present in HTML
    const hasDarkModeSupport = await page.evaluate(() => {
      const html = document.documentElement;
      const darkElements = Array.from(document.querySelectorAll('[class*="dark:"]'));
      return darkElements.length > 0 || html.classList.contains('dark');
    });

    expect(hasDarkModeSupport).toBe(true);
  }, 15000);

  it('has no console errors on page load', async () => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    // Allow some time for any delayed errors
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(consoleErrors.length).toBe(0);
  }, 15000);

  it('takes screenshot for visual verification', async () => {
    await page.goto(`${BASE_URL}/market/${TEST_MARKET_ID}`, {
      waitUntil: 'networkidle2',
    });

    // Wait for content to be fully rendered
    await page.waitForSelector('h1', { timeout: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Take screenshot
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(1000); // Ensure screenshot has content
  }, 15000);
});
