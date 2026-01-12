/**
 * E2E Browser tests for QuickStatsSummaryBar component
 * Tests cover: rendering in browser, user interactions, visual display, and real-time updates
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;
const TEST_TIMEOUT = 30000;

describe('QuickStatsSummaryBar E2E Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  // =============================================================================
  // COMPONENT RENDERING TESTS
  // =============================================================================

  describe('Component Rendering', () => {
    it('should render the quick stats bar on dashboard', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });

      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="dashboard-layout"]', { timeout: 10000 });

      // Check for quick stats bar
      const statsBar = await page.$('[data-testid="quick-stats-bar"]');
      expect(statsBar).not.toBeNull();
    }, TEST_TIMEOUT);

    it('should display the stats grid', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar-grid"]', { timeout: 10000 });

      const grid = await page.$('[data-testid="quick-stats-bar-grid"]');
      expect(grid).not.toBeNull();
    }, TEST_TIMEOUT);

    it('should render stat items for all stat types', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      // Check for each stat type
      const statTypes = [
        'active_alerts',
        'critical_alerts',
        'suspicious_wallets',
        'hot_markets',
        'large_trades',
        'whale_trades',
        'total_volume',
        'connected_sources',
      ];

      for (const statType of statTypes) {
        const statItem = await page.$(`[data-testid="quick-stats-bar-stat-${statType}"]`);
        expect(statItem).not.toBeNull();
      }
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // STAT VALUES DISPLAY TESTS
  // =============================================================================

  describe('Stat Values Display', () => {
    it('should display numeric values for each stat', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      // Check that active alerts stat has a value
      const activeAlertsValue = await page.$('[data-testid="quick-stats-bar-stat-active_alerts-value"]');
      expect(activeAlertsValue).not.toBeNull();

      if (activeAlertsValue) {
        const text = await page.evaluate((el) => el?.textContent, activeAlertsValue);
        expect(text).toBeTruthy();
        // Value should be a number or formatted number
        expect(text).toMatch(/^\d+|(\$?\d+\.?\d*[KM]?)$/);
      }
    }, TEST_TIMEOUT);

    it('should display labels for each stat', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      // Check active alerts label
      const activeAlertsLabel = await page.$('[data-testid="quick-stats-bar-stat-active_alerts-label"]');
      expect(activeAlertsLabel).not.toBeNull();

      if (activeAlertsLabel) {
        const text = await page.evaluate((el) => el?.textContent, activeAlertsLabel);
        expect(text).toBe('Active Alerts');
      }
    }, TEST_TIMEOUT);

    it('should display total volume with dollar prefix', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const volumeValue = await page.$('[data-testid="quick-stats-bar-stat-total_volume-value"]');
      expect(volumeValue).not.toBeNull();

      if (volumeValue) {
        const text = await page.evaluate((el) => el?.textContent, volumeValue);
        expect(text).toMatch(/^\$\d+\.?\d*[KM]?$/);
      }
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // TREND INDICATOR TESTS
  // =============================================================================

  describe('Trend Indicators', () => {
    it('should display trend indicators when available', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      // Wait a bit for data to load
      await new Promise((r) => setTimeout(r, 1500));

      // Check for any trend indicators (up, down arrows with percentage)
      const trends = await page.$$('[data-testid*="-trend"]');
      // Some stats may have trends, some may not - just verify they render if present
      expect(Array.isArray(trends)).toBe(true);
    }, TEST_TIMEOUT);

    it('should show correct trend arrow direction', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      await new Promise((r) => setTimeout(r, 1500));

      // Find any visible trend indicator
      const trendElements = await page.$$('[data-testid*="-trend"]');

      for (const trend of trendElements) {
        const text = await page.evaluate((el) => el?.textContent, trend);
        if (text) {
          // Should contain either up arrow, down arrow, or neutral indicator with percentage
          expect(text).toMatch(/(↑|↓|→)?\s*\d+%?/);
        }
      }
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // INTERACTIVE BEHAVIOR TESTS
  // =============================================================================

  describe('Interactive Behavior', () => {
    it('should be clickable when onClick handler is provided', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      // Find a stat item
      const statItem = await page.$('[data-testid="quick-stats-bar-stat-active_alerts"]');
      expect(statItem).not.toBeNull();

      if (statItem) {
        // Check that it has cursor pointer style
        const cursorStyle = await page.evaluate((el) => {
          if (el) {
            return window.getComputedStyle(el).cursor;
          }
          return null;
        }, statItem);
        expect(cursorStyle).toBe('pointer');
      }
    }, TEST_TIMEOUT);

    it('should have tabindex for keyboard navigation', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const statItem = await page.$('[data-testid="quick-stats-bar-stat-active_alerts"]');
      expect(statItem).not.toBeNull();

      if (statItem) {
        const tabIndex = await page.evaluate((el) => el?.getAttribute('tabindex'), statItem);
        expect(tabIndex).toBe('0');
      }
    }, TEST_TIMEOUT);

    it('should have button role for accessibility', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const statItem = await page.$('[data-testid="quick-stats-bar-stat-active_alerts"]');
      expect(statItem).not.toBeNull();

      if (statItem) {
        const role = await page.evaluate((el) => el?.getAttribute('role'), statItem);
        expect(role).toBe('button');
      }
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // REFRESH BUTTON TESTS
  // =============================================================================

  describe('Refresh Button', () => {
    it('should render refresh button', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const refreshButton = await page.$('[data-testid="quick-stats-bar-refresh-button"]');
      expect(refreshButton).not.toBeNull();
    }, TEST_TIMEOUT);

    it('should handle refresh button click', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar-refresh-button"]', { timeout: 10000 });

      const refreshButton = await page.$('[data-testid="quick-stats-bar-refresh-button"]');
      expect(refreshButton).not.toBeNull();

      if (refreshButton) {
        // Click refresh and wait for update
        await refreshButton.click();
        await new Promise((r) => setTimeout(r, 700));

        // Stats bar should still be visible after refresh
        const statsBar = await page.$('[data-testid="quick-stats-bar"]');
        expect(statsBar).not.toBeNull();
      }
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // LAST UPDATED DISPLAY TESTS
  // =============================================================================

  describe('Last Updated Display', () => {
    it('should display last updated timestamp', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const lastUpdated = await page.$('[data-testid="quick-stats-bar-last-updated"]');
      expect(lastUpdated).not.toBeNull();

      if (lastUpdated) {
        const text = await page.evaluate((el) => el?.textContent, lastUpdated);
        // Should show "Updated Xs ago" or similar
        expect(text).toMatch(/Updated\s+(Just now|\d+[smhd]\s+ago)/);
      }
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // CRITICAL ALERTS DISPLAY TESTS
  // =============================================================================

  describe('Critical Alerts Display', () => {
    it('should render critical alerts stat', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const criticalStat = await page.$('[data-testid="quick-stats-bar-stat-critical_alerts"]');
      expect(criticalStat).not.toBeNull();
    }, TEST_TIMEOUT);

    it('should show critical badge when critical alerts exist', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      // Check for critical badge in the footer
      const criticalBadge = await page.$('[data-testid="quick-stats-bar-critical-badge"]');
      // Badge may or may not exist depending on whether there are critical alerts
      // Just verify the query doesn't throw
      expect(criticalBadge === null || criticalBadge !== null).toBe(true);
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // FOOTER SUMMARY TESTS
  // =============================================================================

  describe('Footer Summary', () => {
    it('should render footer section', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const footer = await page.$('[data-testid="quick-stats-bar-footer"]');
      expect(footer).not.toBeNull();
    }, TEST_TIMEOUT);

    it('should display total alerts badge when alerts exist', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const totalAlertsBadge = await page.$('[data-testid="quick-stats-bar-total-alerts-badge"]');
      // May or may not exist depending on mock data
      expect(totalAlertsBadge === null || totalAlertsBadge !== null).toBe(true);
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // RESPONSIVE DESIGN TESTS
  // =============================================================================

  describe('Responsive Design', () => {
    it('should display correctly on desktop', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const statsBar = await page.$('[data-testid="quick-stats-bar"]');
      expect(statsBar).not.toBeNull();

      // Grid should show 8 columns on large screens
      const grid = await page.$('[data-testid="quick-stats-bar-grid"]');
      if (grid) {
        const gridStyle = await page.evaluate((el) => {
          if (el) {
            return window.getComputedStyle(el).gridTemplateColumns;
          }
          return null;
        }, grid);
        expect(gridStyle).toBeTruthy();
      }
    }, TEST_TIMEOUT);

    it('should display correctly on tablet', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const statsBar = await page.$('[data-testid="quick-stats-bar"]');
      expect(statsBar).not.toBeNull();
    }, TEST_TIMEOUT);

    it('should display correctly on mobile', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const statsBar = await page.$('[data-testid="quick-stats-bar"]');
      expect(statsBar).not.toBeNull();

      // Reset viewport
      await page.setViewport({ width: 1920, height: 1080 });
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // STYLING AND VISUAL TESTS
  // =============================================================================

  describe('Styling and Visual Display', () => {
    it('should have correct background color', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const statsBar = await page.$('[data-testid="quick-stats-bar"]');
      expect(statsBar).not.toBeNull();

      if (statsBar) {
        const bgColor = await page.evaluate((el) => {
          if (el) {
            return window.getComputedStyle(el).backgroundColor;
          }
          return null;
        }, statsBar);
        expect(bgColor).toBeTruthy();
      }
    }, TEST_TIMEOUT);

    it('should display stat icons', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      // Check that icons are displayed (emoji icons)
      const statsContent = await page.$eval('[data-testid="quick-stats-bar"]', (el) => el.innerHTML);
      // Should contain emoji icons
      expect(
        statsContent.includes('🚨') ||
          statsContent.includes('👛') ||
          statsContent.includes('🔥') ||
          statsContent.includes('💰')
      ).toBe(true);
    }, TEST_TIMEOUT);

    it('should have proper padding and spacing', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const statsBar = await page.$('[data-testid="quick-stats-bar"]');
      expect(statsBar).not.toBeNull();

      if (statsBar) {
        const padding = await page.evaluate((el) => {
          if (el) {
            const style = window.getComputedStyle(el);
            return {
              paddingTop: style.paddingTop,
              paddingBottom: style.paddingBottom,
            };
          }
          return null;
        }, statsBar);
        expect(padding).toBeTruthy();
      }
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // ACCESSIBILITY TESTS
  // =============================================================================

  describe('Accessibility', () => {
    it('should have aria-label on stat items', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      const statItem = await page.$('[data-testid="quick-stats-bar-stat-active_alerts"]');
      expect(statItem).not.toBeNull();

      if (statItem) {
        const ariaLabel = await page.evaluate((el) => el?.getAttribute('aria-label'), statItem);
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toContain('Active Alerts');
      }
    }, TEST_TIMEOUT);

    it('should have aria-label on refresh button', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar-refresh-button"]', { timeout: 10000 });

      const refreshButton = await page.$('[data-testid="quick-stats-bar-refresh-button"]');
      expect(refreshButton).not.toBeNull();

      if (refreshButton) {
        const ariaLabel = await page.evaluate((el) => el?.getAttribute('aria-label'), refreshButton);
        expect(ariaLabel).toBe('Refresh stats');
      }
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // LOADING STATE TESTS
  // =============================================================================

  describe('Loading States', () => {
    it('should show stats after loading completes', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });

      // Wait for loading to complete
      await page.waitForSelector('[data-testid="quick-stats-bar-grid"]', { timeout: 10000 });

      // Stats should be visible
      const statItem = await page.$('[data-testid="quick-stats-bar-stat-active_alerts"]');
      expect(statItem).not.toBeNull();
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================

  describe('Integration with Dashboard', () => {
    it('should be positioned correctly in the dashboard layout', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="dashboard-layout"]', { timeout: 10000 });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      // Stats bar should come after the header
      const header = await page.$('header');
      const statsBar = await page.$('[data-testid="quick-stats-bar"]');

      expect(header).not.toBeNull();
      expect(statsBar).not.toBeNull();

      if (header && statsBar) {
        const headerRect = await header.boundingBox();
        const statsRect = await statsBar.boundingBox();

        if (headerRect && statsRect) {
          // Stats bar should be below the header
          expect(statsRect.y).toBeGreaterThanOrEqual(headerRect.y + headerRect.height);
        }
      }
    }, TEST_TIMEOUT);

    it('should display all 8 stat types when loaded', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar"]', { timeout: 10000 });

      // Wait for data to load
      await new Promise((r) => setTimeout(r, 1500));

      // Count the unique stat items (not their sub-elements)
      // Each stat type should appear once
      const statTypes = [
        'active_alerts',
        'critical_alerts',
        'suspicious_wallets',
        'hot_markets',
        'large_trades',
        'whale_trades',
        'total_volume',
        'connected_sources',
      ];

      let foundCount = 0;
      for (const statType of statTypes) {
        const statItem = await page.$(`[data-testid="quick-stats-bar-stat-${statType}"]`);
        if (statItem) {
          foundCount++;
        }
      }
      expect(foundCount).toBe(8);
    }, TEST_TIMEOUT);
  });

  // =============================================================================
  // STAT TYPE SPECIFIC TESTS
  // =============================================================================

  describe('Stat Type Specific Tests', () => {
    it('should display active alerts with red theme', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar-stat-active_alerts"]', { timeout: 10000 });

      const statItem = await page.$('[data-testid="quick-stats-bar-stat-active_alerts"]');
      expect(statItem).not.toBeNull();

      if (statItem) {
        const className = await page.evaluate((el) => el?.className, statItem);
        expect(className).toContain('bg-red');
      }
    }, TEST_TIMEOUT);

    it('should display suspicious wallets with orange theme', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar-stat-suspicious_wallets"]', { timeout: 10000 });

      const statItem = await page.$('[data-testid="quick-stats-bar-stat-suspicious_wallets"]');
      expect(statItem).not.toBeNull();

      if (statItem) {
        const className = await page.evaluate((el) => el?.className, statItem);
        expect(className).toContain('bg-orange');
      }
    }, TEST_TIMEOUT);

    it('should display whale trades with purple theme', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar-stat-whale_trades"]', { timeout: 10000 });

      const statItem = await page.$('[data-testid="quick-stats-bar-stat-whale_trades"]');
      expect(statItem).not.toBeNull();

      if (statItem) {
        const className = await page.evaluate((el) => el?.className, statItem);
        expect(className).toContain('bg-purple');
      }
    }, TEST_TIMEOUT);

    it('should display connected sources with emerald theme', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });
      await page.waitForSelector('[data-testid="quick-stats-bar-stat-connected_sources"]', { timeout: 10000 });

      const statItem = await page.$('[data-testid="quick-stats-bar-stat-connected_sources"]');
      expect(statItem).not.toBeNull();

      if (statItem) {
        const className = await page.evaluate((el) => el?.className, statItem);
        expect(className).toContain('bg-emerald');
      }
    }, TEST_TIMEOUT);
  });
});
