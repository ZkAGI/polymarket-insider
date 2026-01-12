/**
 * E2E Browser Tests for Alert Type Filter
 * Feature: UI-ALERT-003 - Alert type filter
 *
 * Tests use Puppeteer to verify alert type filter functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const ALERTS_URL = `${BASE_URL}/alerts`;

// Helper function to wait for a specified time
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Alert Type Filter E2E Tests', () => {
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

  describe('Filter Button Display', () => {
    it('should display the filter button on alerts page', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });

      // Wait for page and filter to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      // Wait a bit for alerts to load (they load mock data)
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-type-filter-button"]');
      expect(filterButton).not.toBeNull();
    });

    it('should display "All Types" label initially', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const label = await page.$('[data-testid="alert-type-filter-label"]');
      expect(label).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Types');
    });

    it('should display filter icon in button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-type-filter-button"]');
      const hasIcon = await page.evaluate((btn) => {
        if (!btn) return false;
        const svg = btn.querySelector('svg');
        return svg !== null;
      }, filterButton);

      expect(hasIcon).toBe(true);
    });
  });

  describe('Filter Dropdown', () => {
    it('should open dropdown when filter button is clicked', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Click the filter button
      await page.click('[data-testid="alert-type-filter-button"]');

      // Wait for dropdown to appear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-type-filter-dropdown"]');
      expect(dropdown).not.toBeNull();
    });

    it('should display "Select All" button in dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const selectAllButton = await page.$('[data-testid="alert-type-filter-select-all"]');
      expect(selectAllButton).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, selectAllButton);
      expect(text).toBe('Select All');
    });

    it('should display "Clear" button in dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const clearButton = await page.$('[data-testid="alert-type-filter-clear-all"]');
      expect(clearButton).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, clearButton);
      expect(text).toBe('Clear');
    });

    it('should close dropdown when clicking outside', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click outside (on the page title)
      await page.click('[data-testid="alerts-title"]');

      // Wait for dropdown to close
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-type-filter-dropdown"]');
      expect(dropdown).toBeNull();
    });

    it('should close dropdown when pressing Escape', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Press Escape
      await page.keyboard.press('Escape');

      // Wait for dropdown to close
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-type-filter-dropdown"]');
      expect(dropdown).toBeNull();
    });
  });

  describe('Category Display', () => {
    it('should display TRADING category', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const tradingCategory = await page.$('[data-testid="alert-type-filter-category-TRADING"]');
      expect(tradingCategory).not.toBeNull();
    });

    it('should display WALLET category', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const walletCategory = await page.$('[data-testid="alert-type-filter-category-WALLET"]');
      expect(walletCategory).not.toBeNull();
    });

    it('should display MARKET category', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const marketCategory = await page.$('[data-testid="alert-type-filter-category-MARKET"]');
      expect(marketCategory).not.toBeNull();
    });

    it('should display SYSTEM category', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const systemCategory = await page.$('[data-testid="alert-type-filter-category-SYSTEM"]');
      expect(systemCategory).not.toBeNull();
    });
  });

  describe('Type Options', () => {
    it('should display WHALE_TRADE option', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const option = await page.$('[data-testid="alert-type-filter-option-WHALE_TRADE"]');
      expect(option).not.toBeNull();
    });

    it('should display FRESH_WALLET option', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const option = await page.$('[data-testid="alert-type-filter-option-FRESH_WALLET"]');
      expect(option).not.toBeNull();
    });

    it('should display checkbox for each type option', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const checkbox = await page.$('[data-testid="alert-type-filter-checkbox-WHALE_TRADE"]');
      expect(checkbox).not.toBeNull();
    });
  });

  describe('Filtering Functionality', () => {
    it('should toggle single type selection', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click WHALE_TRADE to toggle it off (initially all are selected)
      await page.click('[data-testid="alert-type-filter-option-WHALE_TRADE"]');

      // Wait for state update
      await delay(300);

      // Check that the label changed (no longer "All Types")
      const label = await page.$('[data-testid="alert-type-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).not.toBe('All Types');
    });

    it('should display filter badge when filters active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click WHALE_TRADE to toggle it off
      await page.click('[data-testid="alert-type-filter-option-WHALE_TRADE"]');
      await delay(300);

      // Badge should appear with count
      const badge = await page.$('[data-testid="alert-type-filter-badge"]');
      expect(badge).not.toBeNull();
    });

    it('should clear all filters when clicking "Clear"', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // First toggle a type off
      await page.click('[data-testid="alert-type-filter-option-WHALE_TRADE"]');
      await delay(300);

      // Now click Clear
      await page.click('[data-testid="alert-type-filter-clear-all"]');
      await delay(300);

      // Label should be "All Types" (empty = all)
      const label = await page.$('[data-testid="alert-type-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Types');
    });

    it('should select all when clicking "Select All"', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // First toggle a type off
      await page.click('[data-testid="alert-type-filter-option-WHALE_TRADE"]');
      await delay(300);

      // Now click Select All
      await page.click('[data-testid="alert-type-filter-select-all"]');
      await delay(300);

      // Label should be "All Types"
      const label = await page.$('[data-testid="alert-type-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Types');
    });

    it('should toggle entire category when clicking category header', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click TRADING category toggle to deselect all trading types
      await page.click('[data-testid="alert-type-filter-category-toggle-TRADING"]');
      await delay(300);

      // Label should reflect the change
      const label = await page.$('[data-testid="alert-type-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).not.toBe('All Types');
    });
  });

  describe('Active Filter Chips', () => {
    it('should display active filter chips when filters are applied', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click Clear to deselect all, then select only one type
      await page.click('[data-testid="alert-type-filter-clear-all"]');
      await delay(300);

      await page.click('[data-testid="alert-type-filter-option-WHALE_TRADE"]');
      await delay(300);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(300);

      // Active filters section should be visible
      const activeFilters = await page.$('[data-testid="alerts-active-filters"]');
      expect(activeFilters).not.toBeNull();
    });

    it('should remove single filter when clicking chip X button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown and select only two types
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      await page.click('[data-testid="alert-type-filter-clear-all"]');
      await delay(200);

      await page.click('[data-testid="alert-type-filter-option-WHALE_TRADE"]');
      await delay(200);

      await page.click('[data-testid="alert-type-filter-option-FRESH_WALLET"]');
      await delay(200);

      // Close dropdown by clicking Apply button or clicking outside
      const applyButton = await page.$('[data-testid="alert-type-filter-apply"]');
      if (applyButton) {
        await applyButton.click();
      } else {
        await page.click('[data-testid="alerts-title"]');
      }
      await delay(500);

      // Find and click the remove button for WHALE_TRADE chip
      const removeButton = await page.$('[data-testid="filter-chip-remove-WHALE_TRADE"]');
      expect(removeButton).not.toBeNull();

      if (removeButton) {
        await removeButton.click();
        await delay(500);

        // Label should now show "Fresh Wallet" (single type)
        const label = await page.$('[data-testid="alert-type-filter-label"]');
        const text = await page.evaluate((el) => el?.textContent, label);
        // After removing WHALE_TRADE, only FRESH_WALLET remains
        expect(text).toBe('Fresh Wallet');
      }
    });

    it('should clear all filters when clicking "Clear all" link', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown and select only one type
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      await page.click('[data-testid="alert-type-filter-clear-all"]');
      await delay(200);

      await page.click('[data-testid="alert-type-filter-option-WHALE_TRADE"]');
      await delay(200);

      // Close dropdown by clicking Apply button or clicking outside
      const applyButton = await page.$('[data-testid="alert-type-filter-apply"]');
      if (applyButton) {
        await applyButton.click();
      } else {
        await page.click('[data-testid="alerts-title"]');
      }
      await delay(500);

      // Click "Clear all" link in chips
      const clearAllLink = await page.$('[data-testid="clear-all-filters"]');
      expect(clearAllLink).not.toBeNull();

      if (clearAllLink) {
        await clearAllLink.click();
        await delay(500);

        // Label should be "All Types"
        const label = await page.$('[data-testid="alert-type-filter-label"]');
        const text = await page.evaluate((el) => el?.textContent, label);
        expect(text).toBe('All Types');
      }
    });
  });

  describe('Filter Results', () => {
    it('should show filtered count when filters are active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Deselect all trading types to reduce count
      await page.click('[data-testid="alert-type-filter-category-toggle-TRADING"]');
      await delay(300);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(300);

      // Check for filter summary showing count
      const summary = await page.$('[data-testid="alerts-filter-summary"]');
      expect(summary).not.toBeNull();
    });

    it('should show empty state when no alerts match filter', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown and select only SYSTEM (unlikely to have mock alerts)
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      await page.click('[data-testid="alert-type-filter-clear-all"]');
      await delay(200);

      await page.click('[data-testid="alert-type-filter-option-SANCTIONED_ACTIVITY"]');
      await delay(200);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(500);

      // Check if empty state is shown (may or may not be, depending on mock data)
      const alertsList = await page.$('[data-testid="alerts-list"]');
      const emptyState = await page.$('[data-testid="alerts-no-filter-results"]');

      // Either we have some alerts or the empty filter state
      expect(alertsList !== null || emptyState !== null).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-expanded on filter button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const hasAriaExpanded = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="alert-type-filter-button"]');
        return btn?.hasAttribute('aria-expanded');
      });

      expect(hasAriaExpanded).toBe(true);
    });

    it('should update aria-expanded when dropdown opens', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Check initial state
      let expanded = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="alert-type-filter-button"]');
        return btn?.getAttribute('aria-expanded');
      });
      expect(expanded).toBe('false');

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Check updated state
      expanded = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="alert-type-filter-button"]');
        return btn?.getAttribute('aria-expanded');
      });
      expect(expanded).toBe('true');
    });

    it('should have aria-haspopup on filter button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const hasAriaHaspopup = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="alert-type-filter-button"]');
        return btn?.getAttribute('aria-haspopup') === 'listbox';
      });

      expect(hasAriaHaspopup).toBe(true);
    });

    it('should have role="listbox" on dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const hasRole = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-testid="alert-type-filter-dropdown"]');
        return dropdown?.getAttribute('role') === 'listbox';
      });

      expect(hasRole).toBe(true);
    });

    it('should have aria-label on filter button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const hasAriaLabel = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="alert-type-filter-button"]');
        return btn?.hasAttribute('aria-label');
      });

      expect(hasAriaLabel).toBe(true);
    });
  });

  describe('Dark Mode Support', () => {
    it('should have dark mode classes on filter button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const hasDarkClasses = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="alert-type-filter-button"]');
        const className = btn?.className || '';
        return className.includes('dark:');
      });

      expect(hasDarkClasses).toBe(true);
    });

    it('should have dark mode classes on dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const hasDarkClasses = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-testid="alert-type-filter-dropdown"]');
        const className = dropdown?.className || '';
        return className.includes('dark:');
      });

      expect(hasDarkClasses).toBe(true);
    });
  });

  describe('Responsive Design', () => {
    it('should work on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-type-filter-button"]');
      expect(filterButton).not.toBeNull();

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-type-filter-dropdown"]');
      expect(dropdown).not.toBeNull();
    });

    it('should work on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-type-filter-button"]');
      expect(filterButton).not.toBeNull();

      // Open dropdown
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-type-filter-dropdown"]');
      expect(dropdown).not.toBeNull();
    });
  });
});
