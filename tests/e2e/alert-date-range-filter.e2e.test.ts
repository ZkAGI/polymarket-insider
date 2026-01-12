/**
 * E2E Browser Tests for Alert Date Range Filter
 * Feature: UI-ALERT-005 - Alert date range filter
 *
 * Tests use Puppeteer to verify alert date range filter functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const ALERTS_URL = `${BASE_URL}/alerts`;

// Helper function to wait for a specified time
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Alert Date Range Filter E2E Tests', () => {
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
    it('should display the date range filter button on alerts page', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });

      // Wait for page and filter to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      // Wait a bit for alerts to load (they load mock data)
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-date-range-filter-button"]');
      expect(filterButton).not.toBeNull();
    });

    it('should display "All Time" label initially', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const label = await page.$('[data-testid="alert-date-range-filter-label"]');
      expect(label).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Time');
    });

    it('should display calendar icon in button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-date-range-filter-button"]');
      const hasIcon = await page.evaluate((btn) => {
        if (!btn) return false;
        const svg = btn.querySelector('svg');
        return svg !== null;
      }, filterButton);

      expect(hasIcon).toBe(true);
    });

    it('should display all three filters side by side', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const typeFilter = await page.$('[data-testid="alerts-type-filter"]');
      const severityFilter = await page.$('[data-testid="alerts-severity-filter"]');
      const dateRangeFilter = await page.$('[data-testid="alerts-date-range-filter"]');

      expect(typeFilter).not.toBeNull();
      expect(severityFilter).not.toBeNull();
      expect(dateRangeFilter).not.toBeNull();
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
      await page.click('[data-testid="alert-date-range-filter-button"]');

      // Wait for dropdown to appear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-date-range-filter-dropdown"]');
      expect(dropdown).not.toBeNull();
    });

    it('should display quick select presets in dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Check for quick select presets
      const todayPreset = await page.$('[data-testid="alert-date-range-preset-TODAY"]');
      const yesterdayPreset = await page.$('[data-testid="alert-date-range-preset-YESTERDAY"]');
      const last7DaysPreset = await page.$('[data-testid="alert-date-range-preset-LAST_7_DAYS"]');
      const last30DaysPreset = await page.$('[data-testid="alert-date-range-preset-LAST_30_DAYS"]');

      expect(todayPreset).not.toBeNull();
      expect(yesterdayPreset).not.toBeNull();
      expect(last7DaysPreset).not.toBeNull();
      expect(last30DaysPreset).not.toBeNull();
    });

    it('should display period presets in dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Check for period presets
      const allTimePreset = await page.$('[data-testid="alert-date-range-preset-ALL_TIME"]');
      const thisWeekPreset = await page.$('[data-testid="alert-date-range-preset-THIS_WEEK"]');
      const thisMonthPreset = await page.$('[data-testid="alert-date-range-preset-THIS_MONTH"]');
      const thisYearPreset = await page.$('[data-testid="alert-date-range-preset-THIS_YEAR"]');

      expect(allTimePreset).not.toBeNull();
      expect(thisWeekPreset).not.toBeNull();
      expect(thisMonthPreset).not.toBeNull();
      expect(thisYearPreset).not.toBeNull();
    });

    it('should display custom range toggle in dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const customToggle = await page.$('[data-testid="alert-date-range-custom-toggle"]');
      expect(customToggle).not.toBeNull();
    });

    it('should close dropdown when clicking outside', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click outside (on the page title)
      await page.click('[data-testid="alerts-title"]');

      // Wait for dropdown to close
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-date-range-filter-dropdown"]');
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
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Press Escape
      await page.keyboard.press('Escape');

      // Wait for dropdown to close
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-date-range-filter-dropdown"]');
      expect(dropdown).toBeNull();
    });
  });

  describe('Preset Selection', () => {
    it('should update button label when selecting Today preset', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click Today preset
      await page.click('[data-testid="alert-date-range-preset-TODAY"]');

      // Wait for dropdown to close and label to update
      await delay(500);

      const label = await page.$('[data-testid="alert-date-range-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('Today');
    });

    it('should update button label when selecting Last 7 Days preset', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click Last 7 Days preset
      await page.click('[data-testid="alert-date-range-preset-LAST_7_DAYS"]');

      // Wait for dropdown to close and label to update
      await delay(500);

      const label = await page.$('[data-testid="alert-date-range-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('Last 7 Days');
    });

    it('should update button label when selecting This Month preset', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click This Month preset
      await page.click('[data-testid="alert-date-range-preset-THIS_MONTH"]');

      // Wait for dropdown to close and label to update
      await delay(500);

      const label = await page.$('[data-testid="alert-date-range-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('This Month');
    });

    it('should show active indicator when filter is active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Initially, no active indicator
      let activeIndicator = await page.$('[data-testid="alert-date-range-filter-active-indicator"]');
      expect(activeIndicator).toBeNull();

      // Open dropdown and select a preset
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-preset-TODAY"]');
      await delay(500);

      // Now active indicator should be visible
      activeIndicator = await page.$('[data-testid="alert-date-range-filter-active-indicator"]');
      expect(activeIndicator).not.toBeNull();
    });

    it('should highlight selected preset in dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown and select Last 30 Days
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-preset-LAST_30_DAYS"]');
      await delay(500);

      // Open dropdown again
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Check if LAST_30_DAYS preset has selected styling
      const presetButton = await page.$('[data-testid="alert-date-range-preset-LAST_30_DAYS"]');
      const hasSelectedClass = await page.evaluate((btn) => {
        if (!btn) return false;
        return btn.className.includes('green') || btn.className.includes('selected');
      }, presetButton);

      expect(hasSelectedClass).toBe(true);
    });
  });

  describe('Custom Date Range', () => {
    it('should show custom date inputs when custom toggle is clicked', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click custom toggle
      await page.click('[data-testid="alert-date-range-custom-toggle"]');

      // Wait for custom inputs to appear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-custom-inputs"]') !== null,
        { timeout: 5000 }
      );

      const customInputs = await page.$('[data-testid="alert-date-range-custom-inputs"]');
      expect(customInputs).not.toBeNull();
    });

    it('should display start date input in custom mode', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown and enable custom mode
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-custom-toggle"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-custom-inputs"]') !== null,
        { timeout: 5000 }
      );

      const startInput = await page.$('[data-testid="alert-date-range-start-input"]');
      expect(startInput).not.toBeNull();

      // Check input type is date
      const inputType = await page.evaluate((el) => el?.getAttribute('type'), startInput);
      expect(inputType).toBe('date');
    });

    it('should display end date input in custom mode', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown and enable custom mode
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-custom-toggle"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-custom-inputs"]') !== null,
        { timeout: 5000 }
      );

      const endInput = await page.$('[data-testid="alert-date-range-end-input"]');
      expect(endInput).not.toBeNull();

      // Check input type is date
      const inputType = await page.evaluate((el) => el?.getAttribute('type'), endInput);
      expect(inputType).toBe('date');
    });

    it('should display Apply button in custom mode', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown and enable custom mode
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-custom-toggle"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-custom-inputs"]') !== null,
        { timeout: 5000 }
      );

      const applyButton = await page.$('[data-testid="alert-date-range-apply"]');
      expect(applyButton).not.toBeNull();

      const buttonText = await page.evaluate((el) => el?.textContent, applyButton);
      expect(buttonText).toBe('Apply Range');
    });
  });

  describe('Clear Filter', () => {
    it('should show clear button when filter is active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Select a preset
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-preset-TODAY"]');
      await delay(500);

      // Open dropdown again
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Check for clear button
      const clearButton = await page.$('[data-testid="alert-date-range-filter-clear"]');
      expect(clearButton).not.toBeNull();
    });

    it('should clear filter and reset to All Time when clear is clicked', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Select a preset
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-preset-LAST_7_DAYS"]');
      await delay(500);

      // Verify filter is active
      let label = await page.$('[data-testid="alert-date-range-filter-label"]');
      let text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('Last 7 Days');

      // Open dropdown and clear
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-filter-clear"]');
      await delay(500);

      // Verify filter is cleared
      label = await page.$('[data-testid="alert-date-range-filter-label"]');
      text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Time');
    });
  });

  describe('Active Filter Chip', () => {
    it('should show date range chip when filter is active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Select a preset
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-preset-THIS_WEEK"]');
      await delay(500);

      // Check for date range chip
      const chip = await page.$('[data-testid="date-range-chip"]');
      expect(chip).not.toBeNull();
    });

    it('should not show date range chip for All Time', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Check that no date range chip is shown (All Time is default)
      const chip = await page.$('[data-testid="date-range-chip"]');
      expect(chip).toBeNull();
    });

    it('should clear filter when chip remove button is clicked', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Select a preset
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-preset-YESTERDAY"]');
      await delay(500);

      // Click the remove button on the chip
      await page.click('[data-testid="date-range-chip-remove"]');
      await delay(500);

      // Verify filter is cleared
      const label = await page.$('[data-testid="alert-date-range-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Time');

      // Verify chip is removed
      const chip = await page.$('[data-testid="date-range-chip"]');
      expect(chip).toBeNull();
    });
  });

  describe('Filter Summary', () => {
    it('should show filter summary when date filter is active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Select a date preset
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-preset-LAST_30_DAYS"]');
      await delay(500);

      // Check for filter summary
      const summary = await page.$('[data-testid="alerts-filter-summary"]');
      expect(summary).not.toBeNull();
    });

    it('should show clear all button when filters are active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Select a date preset
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-preset-THIS_YEAR"]');
      await delay(500);

      // Check for clear all button
      const clearAllButton = await page.$('[data-testid="alerts-clear-all-filters"]');
      expect(clearAllButton).not.toBeNull();
    });

    it('should clear all filters when clear all is clicked', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Select a date preset
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-date-range-preset-LAST_90_DAYS"]');
      await delay(500);

      // Click clear all
      await page.click('[data-testid="alerts-clear-all-filters"]');
      await delay(500);

      // Verify date filter is cleared
      const label = await page.$('[data-testid="alert-date-range-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Time');
    });
  });

  describe('Dark Mode Support', () => {
    it('should render correctly in dark mode', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Enable dark mode by adding class to html element
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await delay(200);

      // Open dropdown
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Verify dropdown renders (has dark background classes)
      const dropdown = await page.$('[data-testid="alert-date-range-filter-dropdown"]');
      expect(dropdown).not.toBeNull();

      const hasDarkClasses = await page.evaluate((el) => {
        if (!el) return false;
        return el.className.includes('dark:bg-gray');
      }, dropdown);
      expect(hasDarkClasses).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria attributes on filter button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-date-range-filter-button"]');

      const ariaLabel = await page.evaluate((el) => el?.getAttribute('aria-label'), filterButton);
      const ariaHasPopup = await page.evaluate((el) => el?.getAttribute('aria-haspopup'), filterButton);
      const ariaExpanded = await page.evaluate((el) => el?.getAttribute('aria-expanded'), filterButton);

      expect(ariaLabel).toBe('Filter by date range');
      expect(ariaHasPopup).toBe('listbox');
      expect(ariaExpanded).toBe('false');
    });

    it('should update aria-expanded when dropdown is open', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const filterButton = await page.$('[data-testid="alert-date-range-filter-button"]');
      const ariaExpanded = await page.evaluate((el) => el?.getAttribute('aria-expanded'), filterButton);
      expect(ariaExpanded).toBe('true');
    });

    it('should have listbox role on dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-date-range-filter-dropdown"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), dropdown);
      expect(role).toBe('listbox');
    });
  });

  describe('Responsive Design', () => {
    it('should display filter button on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-date-range-filter-button"]');
      expect(filterButton).not.toBeNull();

      const isVisible = await page.evaluate((el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }, filterButton);
      expect(isVisible).toBe(true);
    });

    it('should display filter dropdown properly on mobile', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Open dropdown
      await page.click('[data-testid="alert-date-range-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-date-range-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-date-range-filter-dropdown"]');
      const isVisible = await page.evaluate((el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }, dropdown);
      expect(isVisible).toBe(true);
    });
  });
});
