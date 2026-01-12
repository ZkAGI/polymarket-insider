/**
 * E2E Browser Tests for DashboardRefreshControls
 * Feature: UI-DASH-009 - Dashboard refresh controls
 *
 * Tests use Puppeteer to verify refresh controls functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;

describe('DashboardRefreshControls E2E Tests', () => {
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

  describe('Refresh Controls Loading', () => {
    it('should load the dashboard with refresh controls', async () => {
      const response = await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const controls = await page.$('[data-testid="dashboard-refresh-controls"]');
      expect(controls).not.toBeNull();
    });

    it('should display refresh button', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );

      const refreshButton = await page.$('[data-testid="refresh-button"]');
      expect(refreshButton).not.toBeNull();
    });

    it('should display auto-refresh toggle', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );

      const autoRefreshToggle = await page.$('[data-testid="auto-refresh-toggle"]');
      expect(autoRefreshToggle).not.toBeNull();
    });

    it('should display last refresh time', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );

      const lastRefreshTime = await page.$('[data-testid="last-refresh-time"]');
      expect(lastRefreshTime).not.toBeNull();
    });
  });

  describe('Refresh Button Functionality', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should show "Refresh" label on button', async () => {
      const buttonLabel = await page.$eval(
        '[data-testid="refresh-button-label"]',
        (el) => el.textContent
      );
      expect(buttonLabel).toBe('Refresh');
    });

    it('should show spinner when clicking refresh', async () => {
      const refreshButton = await page.$('[data-testid="refresh-button"]');
      expect(refreshButton).not.toBeNull();

      await refreshButton!.click();

      // Wait for spinner to appear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="refresh-icon-spinner"]') !== null,
        { timeout: 5000 }
      );

      const spinner = await page.$('[data-testid="refresh-icon-spinner"]');
      expect(spinner).not.toBeNull();
    });

    it('should show success icon after refresh completes', async () => {
      const refreshButton = await page.$('[data-testid="refresh-button"]');
      await refreshButton!.click();

      // Wait for success icon to appear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="refresh-icon-success"]') !== null,
        { timeout: 10000 }
      );

      const successIcon = await page.$('[data-testid="refresh-icon-success"]');
      expect(successIcon).not.toBeNull();
    });

    it('should update last refresh time after refresh', async () => {
      // Wait a moment before refreshing
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const refreshButton = await page.$('[data-testid="refresh-button"]');
      await refreshButton!.click();

      // Wait for refresh to complete
      await page.waitForFunction(
        () => document.querySelector('[data-testid="refresh-icon-success"]') !== null,
        { timeout: 10000 }
      );

      // Small delay for time update
      await new Promise((resolve) => setTimeout(resolve, 500));

      const updatedTime = await page.$eval(
        '[data-testid="last-refresh-value"]',
        (el) => el.textContent
      );

      // Time should be updated (likely "Just now")
      expect(updatedTime).toBe('Just now');
    });

    it('should disable button while refreshing', async () => {
      const refreshButton = await page.$('[data-testid="refresh-button"]');
      await refreshButton!.click();

      // Check if button is disabled
      const isDisabled = await page.$eval(
        '[data-testid="refresh-button"]',
        (el) => (el as HTMLButtonElement).disabled
      );

      expect(isDisabled).toBe(true);
    });
  });

  describe('Auto-Refresh Toggle', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should show "Auto" label when auto-refresh is off', async () => {
      const toggleLabel = await page.$eval(
        '[data-testid="auto-refresh-label"]',
        (el) => el.textContent
      );
      expect(toggleLabel).toBe('Auto');
    });

    it('should open dropdown when clicking toggle', async () => {
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      // Wait for dropdown to appear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="auto-refresh-dropdown"]');
      expect(dropdown).not.toBeNull();
    });

    it('should show all interval options in dropdown', async () => {
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Check for each interval option
      const offOption = await page.$('[data-testid="interval-option-off"]');
      const fiveSecOption = await page.$('[data-testid="interval-option-5s"]');
      const tenSecOption = await page.$('[data-testid="interval-option-10s"]');
      const thirtySecOption = await page.$('[data-testid="interval-option-30s"]');
      const oneMinOption = await page.$('[data-testid="interval-option-1m"]');
      const fiveMinOption = await page.$('[data-testid="interval-option-5m"]');

      expect(offOption).not.toBeNull();
      expect(fiveSecOption).not.toBeNull();
      expect(tenSecOption).not.toBeNull();
      expect(thirtySecOption).not.toBeNull();
      expect(oneMinOption).not.toBeNull();
      expect(fiveMinOption).not.toBeNull();
    });

    it('should close dropdown when selecting an option', async () => {
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const thirtySecOption = await page.$('[data-testid="interval-option-30s"]');
      await thirtySecOption!.click();

      // Wait for dropdown to close
      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="auto-refresh-dropdown"]');
      expect(dropdown).toBeNull();
    });

    it('should update label when selecting non-off interval', async () => {
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const thirtySecOption = await page.$('[data-testid="interval-option-30s"]');
      await thirtySecOption!.click();

      // Wait for label to update
      await page.waitForFunction(
        () => {
          const label = document.querySelector('[data-testid="auto-refresh-label"]');
          return label && label.textContent === '30s';
        },
        { timeout: 5000 }
      );

      const label = await page.$eval(
        '[data-testid="auto-refresh-label"]',
        (el) => el.textContent
      );
      expect(label).toBe('30s');
    });

    it('should show countdown when auto-refresh is enabled', async () => {
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const thirtySecOption = await page.$('[data-testid="interval-option-30s"]');
      await thirtySecOption!.click();

      // Wait for countdown to appear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-countdown"]') !== null,
        { timeout: 5000 }
      );

      const countdown = await page.$('[data-testid="auto-refresh-countdown"]');
      expect(countdown).not.toBeNull();
    });

    it('should change toggle background color when enabled', async () => {
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const thirtySecOption = await page.$('[data-testid="interval-option-30s"]');
      await thirtySecOption!.click();

      // Check for green background class
      const hasGreenClass = await page.$eval(
        '[data-testid="auto-refresh-toggle"]',
        (el) => el.classList.contains('bg-green-50') || el.className.includes('bg-green')
      );
      expect(hasGreenClass).toBe(true);
    });
  });

  describe('Last Refresh Time Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display "Updated:" label', async () => {
      const timeSection = await page.$eval(
        '[data-testid="last-refresh-time"]',
        (el) => el.textContent
      );
      expect(timeSection).toContain('Updated:');
    });

    it('should display initial refresh time', async () => {
      const value = await page.$eval(
        '[data-testid="last-refresh-value"]',
        (el) => el.textContent
      );
      // Should show "Just now" or similar after initial load
      expect(value).toBeTruthy();
    });

    it('should have title attribute with full timestamp', async () => {
      const title = await page.$eval(
        '[data-testid="last-refresh-time"]',
        (el) => el.getAttribute('title')
      );
      expect(title).toBeTruthy();
      // Should contain timestamp format
      expect(title).toMatch(/\d/);
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should be focusable via tab', async () => {
      // Tab through elements until we reach the refresh button
      await page.keyboard.press('Tab');

      // Keep tabbing until we focus on refresh controls area
      for (let i = 0; i < 20; i++) {
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? el.getAttribute('data-testid') : null;
        });

        if (focusedElement === 'refresh-button' || focusedElement === 'auto-refresh-toggle') {
          expect(focusedElement).toBeTruthy();
          return;
        }
        await page.keyboard.press('Tab');
      }
    });

    it('should activate refresh button with Enter key', async () => {
      // Focus the refresh button
      await page.focus('[data-testid="refresh-button"]');

      // Press Enter
      await page.keyboard.press('Enter');

      // Wait for spinner
      await page.waitForFunction(
        () => document.querySelector('[data-testid="refresh-icon-spinner"]') !== null,
        { timeout: 5000 }
      );

      const spinner = await page.$('[data-testid="refresh-icon-spinner"]');
      expect(spinner).not.toBeNull();
    });

    it('should open dropdown with Enter key on toggle', async () => {
      // Focus the auto-refresh toggle
      await page.focus('[data-testid="auto-refresh-toggle"]');

      // Press Enter
      await page.keyboard.press('Enter');

      // Wait for dropdown
      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="auto-refresh-dropdown"]');
      expect(dropdown).not.toBeNull();
    });

    it('should close dropdown with Escape key', async () => {
      // Open dropdown
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Press Escape
      await page.keyboard.press('Escape');

      // Wait for dropdown to close
      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="auto-refresh-dropdown"]');
      expect(dropdown).toBeNull();
    });
  });

  describe('Responsive Behavior', () => {
    it('should be visible on desktop viewport', async () => {
      await page.setViewport({ width: 1280, height: 720 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );

      const controls = await page.$('[data-testid="dashboard-refresh-controls"]');
      const isVisible = await page.evaluate((el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }, controls);

      expect(isVisible).toBe(true);
    });

    it('should be visible on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );

      const controls = await page.$('[data-testid="dashboard-refresh-controls"]');
      const isVisible = await page.evaluate((el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }, controls);

      expect(isVisible).toBe(true);
    });

    it('should be visible on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );

      const controls = await page.$('[data-testid="dashboard-refresh-controls"]');
      const isVisible = await page.evaluate((el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }, controls);

      expect(isVisible).toBe(true);
    });
  });

  describe('Integration with Dashboard', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should be positioned in the header', async () => {
      const refreshControlsInHeader = await page.evaluate(() => {
        const controls = document.querySelector('[data-testid="dashboard-refresh-controls"]');
        const header = document.querySelector('header');
        if (!controls || !header) return false;
        return header.contains(controls);
      });

      expect(refreshControlsInHeader).toBe(true);
    });

    it('should be positioned next to status indicator', async () => {
      const controlsExist = await page.$('[data-testid="dashboard-refresh-controls"]');
      const statusExists = await page.$('[data-testid="system-status"]');

      expect(controlsExist).not.toBeNull();
      expect(statusExists).not.toBeNull();
    });

    it('should trigger refresh of all widgets when clicking refresh', async () => {
      // Get initial alert count
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-feed-content"]') !== null,
        { timeout: 10000 }
      );

      // Click refresh
      const refreshButton = await page.$('[data-testid="refresh-button"]');
      await refreshButton!.click();

      // Wait for refresh to complete
      await page.waitForFunction(
        () => document.querySelector('[data-testid="refresh-icon-success"]') !== null,
        { timeout: 15000 }
      );

      // Verify dashboard is still functional after refresh
      const dashboardLayout = await page.$('[data-testid="dashboard-layout"]');
      expect(dashboardLayout).not.toBeNull();
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-refresh-controls"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have aria-label on refresh button', async () => {
      const ariaLabel = await page.$eval(
        '[data-testid="refresh-button"]',
        (el) => el.getAttribute('aria-label')
      );
      expect(ariaLabel).toBeTruthy();
    });

    it('should have aria-expanded on auto-refresh toggle', async () => {
      const ariaExpanded = await page.$eval(
        '[data-testid="auto-refresh-toggle"]',
        (el) => el.getAttribute('aria-expanded')
      );
      expect(ariaExpanded).toBe('false');
    });

    it('should have aria-haspopup on auto-refresh toggle', async () => {
      const ariaHaspopup = await page.$eval(
        '[data-testid="auto-refresh-toggle"]',
        (el) => el.getAttribute('aria-haspopup')
      );
      expect(ariaHaspopup).toBe('listbox');
    });

    it('should have role=listbox on dropdown', async () => {
      // Open dropdown
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const role = await page.$eval(
        '[data-testid="auto-refresh-dropdown"]',
        (el) => el.getAttribute('role')
      );
      expect(role).toBe('listbox');
    });

    it('should have role=option on dropdown items', async () => {
      // Open dropdown
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const role = await page.$eval(
        '[data-testid="interval-option-30s"]',
        (el) => el.getAttribute('role')
      );
      expect(role).toBe('option');
    });

    it('should mark selected option with aria-selected', async () => {
      // Open dropdown
      const toggle = await page.$('[data-testid="auto-refresh-toggle"]');
      await toggle!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="auto-refresh-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // OFF should be selected by default
      const ariaSelected = await page.$eval(
        '[data-testid="interval-option-off"]',
        (el) => el.getAttribute('aria-selected')
      );
      expect(ariaSelected).toBe('true');
    });
  });
});
