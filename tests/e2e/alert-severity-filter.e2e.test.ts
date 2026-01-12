/**
 * E2E Browser Tests for Alert Severity Filter
 * Feature: UI-ALERT-004 - Alert severity filter
 *
 * Tests use Puppeteer to verify alert severity filter functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const ALERTS_URL = `${BASE_URL}/alerts`;

// Helper function to wait for a specified time
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Alert Severity Filter E2E Tests', () => {
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
    it('should display the severity filter button on alerts page', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });

      // Wait for page and filter to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      // Wait a bit for alerts to load (they load mock data)
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-severity-filter-button"]');
      expect(filterButton).not.toBeNull();
    });

    it('should display "All Severities" label initially', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const label = await page.$('[data-testid="alert-severity-filter-label"]');
      expect(label).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Severities');
    });

    it('should display severity icon in button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const filterButton = await page.$('[data-testid="alert-severity-filter-button"]');
      const hasIcon = await page.evaluate((btn) => {
        if (!btn) return false;
        const svg = btn.querySelector('svg');
        return svg !== null;
      }, filterButton);

      expect(hasIcon).toBe(true);
    });

    it('should display both type and severity filters side by side', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const typeFilter = await page.$('[data-testid="alerts-type-filter"]');
      const severityFilter = await page.$('[data-testid="alerts-severity-filter"]');

      expect(typeFilter).not.toBeNull();
      expect(severityFilter).not.toBeNull();
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
      await page.click('[data-testid="alert-severity-filter-button"]');

      // Wait for dropdown to appear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-severity-filter-dropdown"]');
      expect(dropdown).not.toBeNull();
    });

    it('should display "Select All" button in dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const selectAllButton = await page.$('[data-testid="alert-severity-filter-select-all"]');
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

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const clearButton = await page.$('[data-testid="alert-severity-filter-clear-all"]');
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
      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click outside (on the page title)
      await page.click('[data-testid="alerts-title"]');

      // Wait for dropdown to close
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-severity-filter-dropdown"]');
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
      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Press Escape
      await page.keyboard.press('Escape');

      // Wait for dropdown to close
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-severity-filter-dropdown"]');
      expect(dropdown).toBeNull();
    });
  });

  describe('Severity Options Display', () => {
    it('should display CRITICAL severity option', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const criticalOption = await page.$('[data-testid="alert-severity-filter-option-CRITICAL"]');
      expect(criticalOption).not.toBeNull();
    });

    it('should display HIGH severity option', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const highOption = await page.$('[data-testid="alert-severity-filter-option-HIGH"]');
      expect(highOption).not.toBeNull();
    });

    it('should display MEDIUM severity option', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const mediumOption = await page.$('[data-testid="alert-severity-filter-option-MEDIUM"]');
      expect(mediumOption).not.toBeNull();
    });

    it('should display LOW severity option', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const lowOption = await page.$('[data-testid="alert-severity-filter-option-LOW"]');
      expect(lowOption).not.toBeNull();
    });

    it('should display INFO severity option', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const infoOption = await page.$('[data-testid="alert-severity-filter-option-INFO"]');
      expect(infoOption).not.toBeNull();
    });

    it('should display all 5 severity options', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      for (const severity of severities) {
        const option = await page.$(`[data-testid="alert-severity-filter-option-${severity}"]`);
        expect(option).not.toBeNull();
      }
    });
  });

  describe('Quick Presets', () => {
    it('should display "Critical & High" preset button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const presetButton = await page.$('[data-testid="alert-severity-filter-preset-critical-high"]');
      expect(presetButton).not.toBeNull();
    });

    it('should display "Medium & Above" preset button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const presetButton = await page.$('[data-testid="alert-severity-filter-preset-medium-above"]');
      expect(presetButton).not.toBeNull();
    });

    it('should select CRITICAL and HIGH when clicking "Critical & High" preset', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click the preset
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');

      // Wait for update
      await delay(500);

      // Check the label updated
      const label = await page.$('[data-testid="alert-severity-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('Critical & High');
    });

    it('should select CRITICAL, HIGH, and MEDIUM when clicking "Medium & Above" preset', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click the preset
      await page.click('[data-testid="alert-severity-filter-preset-medium-above"]');

      // Wait for update
      await delay(500);

      // Check the label updated
      const label = await page.$('[data-testid="alert-severity-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('Medium and above');
    });
  });

  describe('Severity Selection', () => {
    it('should toggle a severity when clicking on it', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click on INFO to deselect it (all are selected initially)
      await page.click('[data-testid="alert-severity-filter-option-INFO"]');
      await delay(300);

      // Check that we now have 4 levels selected
      const label = await page.$('[data-testid="alert-severity-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('4 levels');
    });

    it('should display badge count when filters are active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click on preset to have fewer selections
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(300);

      // Check that badge appears
      const badge = await page.$('[data-testid="alert-severity-filter-badge"]');
      expect(badge).not.toBeNull();

      const badgeText = await page.evaluate((el) => el?.textContent, badge);
      expect(badgeText).toBe('2');
    });

    it('should clear all selections when clicking Clear', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // First select a preset to have some selection
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);

      // Now click Clear
      await page.click('[data-testid="alert-severity-filter-clear-all"]');
      await delay(300);

      // Label should show "All Severities" (when empty, we show all)
      const label = await page.$('[data-testid="alert-severity-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Severities');
    });

    it('should select all when clicking Select All', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // First select a preset to have fewer selections
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);

      // Now click Select All
      await page.click('[data-testid="alert-severity-filter-select-all"]');
      await delay(300);

      // Label should show "All Severities"
      const label = await page.$('[data-testid="alert-severity-filter-label"]');
      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBe('All Severities');
    });
  });

  describe('Filter Chips Display', () => {
    it('should display severity chips when filter is active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Select Critical & High preset
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(500);

      // Check for active severity chips
      const severityChips = await page.$('[data-testid="alerts-active-severity-filters"]');
      expect(severityChips).not.toBeNull();
    });

    it('should remove severity chip when clicking X button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Select Critical & High preset
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(500);

      // Remove CRITICAL chip
      const removeButton = await page.$('[data-testid="severity-chip-remove-CRITICAL"]');
      if (removeButton) {
        await removeButton.click();
        await delay(300);

        // Label should now show only "High"
        const label = await page.$('[data-testid="alert-severity-filter-label"]');
        const text = await page.evaluate((el) => el?.textContent, label);
        expect(text).toBe('High');
      }
    });
  });

  describe('Filter Summary', () => {
    it('should display filter summary when severity filter is active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Select Critical & High preset
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(500);

      // Check filter summary is displayed
      const summary = await page.$('[data-testid="alerts-filter-summary"]');
      expect(summary).not.toBeNull();
    });

    it('should display clear all button in summary', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Select Critical & High preset
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(500);

      // Check clear all button is displayed
      const clearAllButton = await page.$('[data-testid="alerts-clear-all-filters"]');
      expect(clearAllButton).not.toBeNull();
    });

    it('should clear all filters when clicking "Clear all" in summary', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Select Critical & High preset
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(500);

      // Click clear all
      await page.click('[data-testid="alerts-clear-all-filters"]');
      await delay(500);

      // Verify severity filter label shows All Severities
      const severityLabel = await page.$('[data-testid="alert-severity-filter-label"]');
      const severityText = await page.evaluate((el) => el?.textContent, severityLabel);
      expect(severityText).toBe('All Severities');
    });
  });

  describe('Combined Type and Severity Filtering', () => {
    it('should work with both type and severity filters applied', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Apply severity filter first
      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);
      await page.keyboard.press('Escape');
      await delay(500);

      // Apply type filter
      await page.click('[data-testid="alert-type-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-type-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      // Deselect some types
      await page.click('[data-testid="alert-type-filter-option-SYSTEM"]');
      await delay(300);
      await page.keyboard.press('Escape');
      await delay(500);

      // Verify both filters are shown
      const severityBadge = await page.$('[data-testid="alert-severity-filter-badge"]');
      const typeBadge = await page.$('[data-testid="alert-type-filter-badge"]');

      expect(severityBadge).not.toBeNull();
      expect(typeBadge).not.toBeNull();
    });

    it('should clear both filters when clicking global clear all', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      // Apply severity filter
      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);
      await page.keyboard.press('Escape');
      await delay(500);

      // Click global clear all
      await page.click('[data-testid="alerts-clear-all-filters"]');
      await delay(500);

      // Verify both filters are reset
      const severityLabel = await page.$('[data-testid="alert-severity-filter-label"]');
      const severityText = await page.evaluate((el) => el?.textContent, severityLabel);
      expect(severityText).toBe('All Severities');

      const typeLabel = await page.$('[data-testid="alert-type-filter-label"]');
      const typeText = await page.evaluate((el) => el?.textContent, typeLabel);
      expect(typeText).toBe('All Types');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-expanded attribute on button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const button = await page.$('[data-testid="alert-severity-filter-button"]');
      const ariaExpanded = await page.evaluate((btn) => btn?.getAttribute('aria-expanded'), button);
      expect(ariaExpanded).toBe('false');

      // Open dropdown
      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const ariaExpandedAfter = await page.evaluate(
        (btn) => btn?.getAttribute('aria-expanded'),
        button
      );
      expect(ariaExpandedAfter).toBe('true');
    });

    it('should have aria-haspopup attribute on button', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      const button = await page.$('[data-testid="alert-severity-filter-button"]');
      const ariaHasPopup = await page.evaluate((btn) => btn?.getAttribute('aria-haspopup'), button);
      expect(ariaHasPopup).toBe('listbox');
    });

    it('should have role=listbox on dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="alert-severity-filter-dropdown"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), dropdown);
      expect(role).toBe('listbox');
    });

    it('should have role=option on severity items', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const option = await page.$('[data-testid="alert-severity-filter-option-CRITICAL"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), option);
      expect(role).toBe('option');
    });
  });

  describe('Visual Appearance', () => {
    it('should have purple border when filter is active', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Select Critical & High preset
      await page.click('[data-testid="alert-severity-filter-preset-critical-high"]');
      await delay(300);

      // Close dropdown
      await page.keyboard.press('Escape');
      await delay(300);

      // Check that button has border-purple class
      const button = await page.$('[data-testid="alert-severity-filter-button"]');
      const hasActiveBorder = await page.evaluate((btn) => {
        if (!btn) return false;
        return btn.className.includes('border-purple');
      }, button);

      expect(hasActiveBorder).toBe(true);
    });

    it('should display colored severity badges in dropdown', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Check that CRITICAL option has red styling
      const criticalOption = await page.$('[data-testid="alert-severity-filter-option-CRITICAL"]');
      const hasRedStyling = await page.evaluate((opt) => {
        if (!opt) return false;
        const badge = opt.querySelector('.bg-red-100, .bg-red-900');
        return badge !== null;
      }, criticalOption);

      expect(hasRedStyling).toBe(true);
    });

    it('should display severity icons next to options', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await delay(1000);

      await page.click('[data-testid="alert-severity-filter-button"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-severity-filter-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Check for icon
      const icon = await page.$('[data-testid="alert-severity-filter-icon-CRITICAL"]');
      expect(icon).not.toBeNull();

      const iconText = await page.evaluate((el) => el?.textContent, icon);
      expect(iconText).toBe('🔴');
    });
  });
});
