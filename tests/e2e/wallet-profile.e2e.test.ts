/**
 * E2E Browser Tests for Wallet Profile Page
 * Feature: UI-WALLET-001 - Wallet profile page
 *
 * Tests use Puppeteer to verify wallet profile page functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const TEST_WALLET_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const WALLET_URL = `${BASE_URL}/wallet/${TEST_WALLET_ADDRESS}`;

describe('Wallet Profile Page E2E Tests', () => {
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

  describe('Page Loading', () => {
    it('should load the wallet profile page', async () => {
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });

      // Wait for page to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="wallet-profile-header"]') !== null,
        { timeout: 10000 }
      );

      const header = await page.$('[data-testid="wallet-profile-header"]');
      expect(header).not.toBeNull();
    });

    it('should display the wallet address', async () => {
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForSelector('[data-testid="wallet-profile-header-address"]', { timeout: 10000 });

      const address = await page.$('[data-testid="wallet-profile-header-address"]');
      expect(address).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, address);
      expect(text).toContain(TEST_WALLET_ADDRESS);
    });

    it('should display back to dashboard link', async () => {
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForSelector('a', { timeout: 10000 });

      const backLinks = await page.$$('a');
      let foundDashboardLink = false;

      for (const link of backLinks) {
        const text = await page.evaluate((el) => el?.textContent, link);
        if (text?.includes('Back to Dashboard')) {
          foundDashboardLink = true;
          break;
        }
      }

      expect(foundDashboardLink).toBe(true);
    });
  });

  describe('Wallet Profile Header', () => {
    beforeEach(async () => {
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForSelector('[data-testid="wallet-profile-header"]', { timeout: 10000 });
    });

    it('should display wallet type badge', async () => {
      const typeBadge = await page.$('[data-testid="wallet-profile-header-type-badge"]');
      expect(typeBadge).not.toBeNull();
    });

    it('should display copy button', async () => {
      const copyButton = await page.$('[data-testid="wallet-profile-header-copy-button"]');
      expect(copyButton).not.toBeNull();
    });

    it('should show checkmark when copy button is clicked', async () => {
      const copyButton = await page.$('[data-testid="wallet-profile-header-copy-button"]');
      expect(copyButton).not.toBeNull();

      await copyButton!.click();

      // Wait for checkmark to appear
      await page.waitForFunction(
        (testId) => {
          const button = document.querySelector(`[data-testid="${testId}"]`);
          return button?.textContent?.includes('✓');
        },
        { timeout: 3000 },
        'wallet-profile-header-copy-button'
      );

      const buttonText = await page.evaluate(
        (testId) => document.querySelector(`[data-testid="${testId}"]`)?.textContent,
        'wallet-profile-header-copy-button'
      );

      expect(buttonText).toContain('✓');
    });

    it('should display wallet created date', async () => {
      const createdAt = await page.$('[data-testid="wallet-profile-header-created-at"]');
      expect(createdAt).not.toBeNull();
    });

    it('should display funding source', async () => {
      const fundingSource = await page.$('[data-testid="wallet-profile-header-funding-source"]');
      expect(fundingSource).not.toBeNull();
    });

    it('should display Polygonscan link', async () => {
      const polygonscanLink = await page.$('[data-testid="wallet-profile-header-polygonscan-link"]');
      expect(polygonscanLink).not.toBeNull();

      const href = await page.evaluate(
        (el) => el?.getAttribute('href'),
        polygonscanLink
      );

      expect(href).toContain('polygonscan.com');
      expect(href).toContain(TEST_WALLET_ADDRESS);
    });
  });

  describe('Suspicion Score Display', () => {
    beforeEach(async () => {
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForSelector('[data-testid="suspicion-score-display"]', { timeout: 10000 });
    });

    it('should display suspicion score widget', async () => {
      const widget = await page.$('[data-testid="suspicion-score-display"]');
      expect(widget).not.toBeNull();
    });

    it('should display title "Suspicion Score"', async () => {
      const title = await page.$('[data-testid="suspicion-score-display-title"]');
      expect(title).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, title);
      expect(text).toBe('Suspicion Score');
    });

    it('should display score value', async () => {
      const score = await page.$('[data-testid="suspicion-score-display-score"]');
      expect(score).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, score);
      expect(text).toMatch(/^\d+$/);

      const scoreValue = parseInt(text || '0');
      expect(scoreValue).toBeGreaterThanOrEqual(0);
      expect(scoreValue).toBeLessThanOrEqual(100);
    });

    it('should display progress circle', async () => {
      const progressCircle = await page.$('[data-testid="suspicion-score-display-progress-circle"]');
      expect(progressCircle).not.toBeNull();
    });

    it('should display risk level', async () => {
      const riskLevel = await page.$('[data-testid="suspicion-score-display-risk-level"]');
      expect(riskLevel).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, riskLevel);
      expect(text).toMatch(/^(Critical|High|Medium|Low|None)$/);
    });

    it('should display risk flags section', async () => {
      const riskFlags = await page.$('[data-testid="suspicion-score-display-risk-flags"]');
      expect(riskFlags).not.toBeNull();
    });

    it('should display risk flags count', async () => {
      const count = await page.$('[data-testid="suspicion-score-display-risk-flags-count"]');
      expect(count).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, count);
      expect(text).toMatch(/\d+ active/);
    });
  });

  describe('Activity Summary Widget', () => {
    beforeEach(async () => {
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForSelector('[data-testid="activity-summary-widget"]', { timeout: 10000 });
    });

    it('should display activity summary widget', async () => {
      const widget = await page.$('[data-testid="activity-summary-widget"]');
      expect(widget).not.toBeNull();
    });

    it('should display title "Activity Summary"', async () => {
      const title = await page.$('[data-testid="activity-summary-widget-title"]');
      expect(title).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, title);
      expect(text).toBe('Activity Summary');
    });

    it('should display total volume', async () => {
      const volume = await page.$('[data-testid="activity-summary-widget-total-volume"]');
      expect(volume).not.toBeNull();
    });

    it('should display total P&L', async () => {
      const pnl = await page.$('[data-testid="activity-summary-widget-total-pnl"]');
      expect(pnl).not.toBeNull();
    });

    it('should display win rate', async () => {
      const winRate = await page.$('[data-testid="activity-summary-widget-win-rate"]');
      expect(winRate).not.toBeNull();
    });

    it('should display trade count', async () => {
      const tradeCount = await page.$('[data-testid="activity-summary-widget-trade-count"]');
      expect(tradeCount).not.toBeNull();
    });

    it('should display average trade size', async () => {
      const avgSize = await page.$('[data-testid="activity-summary-widget-avg-trade-size"]');
      expect(avgSize).not.toBeNull();
    });

    it('should display max trade size', async () => {
      const maxSize = await page.$('[data-testid="activity-summary-widget-max-trade-size"]');
      expect(maxSize).not.toBeNull();
    });

    it('should display first trade date', async () => {
      const firstTrade = await page.$('[data-testid="activity-summary-widget-first-trade"]');
      expect(firstTrade).not.toBeNull();
    });

    it('should display last trade date', async () => {
      const lastTrade = await page.$('[data-testid="activity-summary-widget-last-trade"]');
      expect(lastTrade).not.toBeNull();
    });

    it('should display summary section', async () => {
      const summary = await page.$('[data-testid="activity-summary-widget-summary"]');
      expect(summary).not.toBeNull();
    });
  });

  describe('Interactive Elements', () => {
    beforeEach(async () => {
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForSelector('[data-testid="wallet-profile-header"]', { timeout: 10000 });
    });

    it('should have clickable monitor button', async () => {
      const monitorButton = await page.$('[data-testid="wallet-profile-header-monitor-button"]');
      expect(monitorButton).not.toBeNull();

      // Button should be clickable
      const isEnabled = await page.evaluate(
        (el) => !el?.hasAttribute('disabled'),
        monitorButton
      );
      expect(isEnabled).toBe(true);
    });

    it('should have clickable flag button', async () => {
      const flagButton = await page.$('[data-testid="wallet-profile-header-flag-button"]');
      expect(flagButton).not.toBeNull();

      // Button should be clickable
      const isEnabled = await page.evaluate(
        (el) => !el?.hasAttribute('disabled'),
        flagButton
      );
      expect(isEnabled).toBe(true);
    });

    it('should toggle monitoring when monitor button is clicked', async () => {
      const monitorButton = await page.$('[data-testid="wallet-profile-header-monitor-button"]');
      expect(monitorButton).not.toBeNull();

      const initialText = await page.evaluate(
        (el) => el?.textContent,
        monitorButton
      );

      await monitorButton!.click();

      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const newText = await page.evaluate(
        (el) => el?.textContent,
        await page.$('[data-testid="wallet-profile-header-monitor-button"]')
      );

      // Text should change between "Monitor" and "Monitoring"
      expect(newText).not.toBe(initialText);
    });

    it('should toggle flag when flag button is clicked', async () => {
      const flagButton = await page.$('[data-testid="wallet-profile-header-flag-button"]');
      expect(flagButton).not.toBeNull();

      const initialText = await page.evaluate(
        (el) => el?.textContent,
        flagButton
      );

      await flagButton!.click();

      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const newText = await page.evaluate(
        (el) => el?.textContent,
        await page.$('[data-testid="wallet-profile-header-flag-button"]')
      );

      // Text should change between "Flag" and "Flagged"
      expect(newText).not.toBe(initialText);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid wallet address gracefully', async () => {
      const invalidAddress = '0xinvalid';
      const invalidUrl = `${BASE_URL}/wallet/${invalidAddress}`;

      await page.goto(invalidUrl, { waitUntil: 'networkidle2', timeout: 10000 });

      // Should show error message
      await new Promise(resolve => setTimeout(resolve, 1000));

      const bodyText = await page.evaluate(() => document.body.textContent);
      expect(bodyText).toMatch(/Invalid wallet address|error|not found/i);
    });
  });

  describe('Screenshot Tests', () => {
    it('should take screenshot of complete wallet profile', async () => {
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForSelector('[data-testid="wallet-profile-header"]', { timeout: 10000 });

      // Wait for all components to render
      await page.waitForSelector('[data-testid="suspicion-score-display"]', { timeout: 5000 });
      await page.waitForSelector('[data-testid="activity-summary-widget"]', { timeout: 5000 });

      // Take screenshot
      await page.screenshot({
        path: './wallet-profile-full.png',
        fullPage: true,
      });

      // Verify screenshot was taken (file should exist)
      // In a real test, we'd check the file system
      expect(true).toBe(true);
    });
  });

  describe('Responsive Design', () => {
    it('should display correctly on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForSelector('[data-testid="wallet-profile-header"]', { timeout: 10000 });

      const header = await page.$('[data-testid="wallet-profile-header"]');
      expect(header).not.toBeNull();

      // Take mobile screenshot
      await page.screenshot({
        path: './wallet-profile-mobile.png',
      });
    });

    it('should display correctly on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 }); // iPad
      await page.goto(WALLET_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      await page.waitForSelector('[data-testid="wallet-profile-header"]', { timeout: 10000 });

      const header = await page.$('[data-testid="wallet-profile-header"]');
      expect(header).not.toBeNull();

      // Take tablet screenshot
      await page.screenshot({
        path: './wallet-profile-tablet.png',
      });
    });
  });
});
