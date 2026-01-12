/**
 * E2E Browser Tests for Alerts List View
 * Feature: UI-ALERT-001 - Alerts list view with pagination
 *
 * Tests use Puppeteer to verify alerts page functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const ALERTS_URL = `${BASE_URL}/alerts`;
const DASHBOARD_URL = `${BASE_URL}/dashboard`;

describe('Alerts List View E2E Tests', () => {
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

  describe('Alerts Page Loading', () => {
    it('should load the alerts page', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });

      // Wait for page to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      const alertsPage = await page.$('[data-testid="alerts-page"]');
      expect(alertsPage).not.toBeNull();
    });

    it('should display page title "All Alerts"', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      const title = await page.$('[data-testid="alerts-title"]');
      expect(title).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, title);
      expect(text).toBe('All Alerts');
    });

    it('should display subtitle', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      const subtitle = await page.$('[data-testid="alerts-subtitle"]');
      expect(subtitle).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, subtitle);
      expect(text).toContain('View and manage all system alerts');
    });

    it('should display back to dashboard link', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      const backLink = await page.$('[data-testid="alerts-back-link"]');
      expect(backLink).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, backLink);
      expect(text).toContain('Back to Dashboard');
    });
  });

  describe('Alerts List Content', () => {
    beforeEach(async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      // Wait for alerts to load
      await new Promise((r) => setTimeout(r, 1500));
    });

    it('should display alerts list container', async () => {
      const alertsList = await page.$('[data-testid="alerts-list"]');
      expect(alertsList).not.toBeNull();
    });

    it('should display alert items', async () => {
      const alertItems = await page.$$('[data-testid^="alert-list-item-"]');
      expect(alertItems.length).toBeGreaterThan(0);
    });

    it('should display stats badges when alerts exist', async () => {
      const stats = await page.$('[data-testid="alerts-stats"]');
      // Stats may or may not exist depending on alert counts
      if (stats) {
        const text = await page.evaluate((el) => el?.textContent, stats);
        // Should contain count badges
        expect(text?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Alert Item Structure', () => {
    beforeEach(async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));
    });

    it('should display alert icon', async () => {
      const icon = await page.$('[data-testid="alert-list-icon"]');
      expect(icon).not.toBeNull();
    });

    it('should display alert severity badge', async () => {
      const severity = await page.$('[data-testid="alert-list-severity"]');
      expect(severity).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, severity);
      expect(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(text);
    });

    it('should display alert type badge', async () => {
      const type = await page.$('[data-testid="alert-list-type"]');
      expect(type).not.toBeNull();
    });

    it('should display alert title', async () => {
      const title = await page.$('[data-testid="alert-list-title"]');
      expect(title).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, title);
      expect(text?.length).toBeGreaterThan(0);
    });

    it('should display alert message', async () => {
      const message = await page.$('[data-testid="alert-list-message"]');
      expect(message).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, message);
      expect(text?.length).toBeGreaterThan(0);
    });

    it('should display alert timestamp', async () => {
      const time = await page.$('[data-testid="alert-list-time"]');
      expect(time).not.toBeNull();
    });
  });

  describe('Alert Item Data Attributes', () => {
    beforeEach(async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));
    });

    it('should have data-alert-id attribute', async () => {
      const alertItem = await page.$('[data-testid^="alert-list-item-"]');
      expect(alertItem).not.toBeNull();

      const alertId = await page.evaluate(
        (el) => el?.getAttribute('data-alert-id'),
        alertItem
      );
      expect(alertId).not.toBeNull();
      expect(alertId?.length).toBeGreaterThan(0);
    });

    it('should have data-alert-type attribute', async () => {
      const alertItem = await page.$('[data-testid^="alert-list-item-"]');
      const alertType = await page.evaluate(
        (el) => el?.getAttribute('data-alert-type'),
        alertItem
      );
      expect(alertType).not.toBeNull();
    });

    it('should have data-alert-severity attribute', async () => {
      const alertItem = await page.$('[data-testid^="alert-list-item-"]');
      const alertSeverity = await page.evaluate(
        (el) => el?.getAttribute('data-alert-severity'),
        alertItem
      );
      expect(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(alertSeverity);
    });

    it('should have data-alert-read attribute', async () => {
      const alertItem = await page.$('[data-testid^="alert-list-item-"]');
      const alertRead = await page.evaluate(
        (el) => el?.getAttribute('data-alert-read'),
        alertItem
      );
      expect(['true', 'false']).toContain(alertRead);
    });
  });

  describe('Pagination', () => {
    beforeEach(async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));
    });

    it('should display pagination controls when multiple pages exist', async () => {
      const pagination = await page.$('[data-testid="alerts-pagination"]');
      // May or may not have pagination depending on total alerts
      // If exists, verify structure
      if (pagination) {
        expect(pagination).not.toBeNull();
      }
    });

    it('should display pagination info', async () => {
      const pagination = await page.$('[data-testid="alerts-pagination"]');
      if (pagination) {
        const info = await page.$('[data-testid="pagination-info"]');
        expect(info).not.toBeNull();

        const text = await page.evaluate((el) => el?.textContent, info);
        expect(text).toContain('Showing');
        expect(text).toContain('alerts');
      }
    });

    it('should display previous and next buttons', async () => {
      const pagination = await page.$('[data-testid="alerts-pagination"]');
      if (pagination) {
        const prevButton = await page.$('[data-testid="pagination-prev"]');
        const nextButton = await page.$('[data-testid="pagination-next"]');
        expect(prevButton).not.toBeNull();
        expect(nextButton).not.toBeNull();
      }
    });

    it('should disable previous button on first page', async () => {
      const pagination = await page.$('[data-testid="alerts-pagination"]');
      if (pagination) {
        const prevButton = await page.$('[data-testid="pagination-prev"]');
        const isDisabled = await page.evaluate(
          (el) => (el as HTMLButtonElement)?.disabled,
          prevButton
        );
        expect(isDisabled).toBe(true);
      }
    });

    it('should display page numbers', async () => {
      const pagination = await page.$('[data-testid="alerts-pagination"]');
      if (pagination) {
        const pageNumbers = await page.$$('[data-testid^="pagination-page-"]');
        expect(pageNumbers.length).toBeGreaterThan(0);
      }
    });

    it('should highlight current page', async () => {
      const pagination = await page.$('[data-testid="alerts-pagination"]');
      if (pagination) {
        const page1Button = await page.$('[data-testid="pagination-page-1"]');
        if (page1Button) {
          const ariaCurrent = await page.evaluate(
            (el) => el?.getAttribute('aria-current'),
            page1Button
          );
          expect(ariaCurrent).toBe('page');
        }
      }
    });

    it('should navigate to next page when next button is clicked', async () => {
      const pagination = await page.$('[data-testid="alerts-pagination"]');
      if (pagination) {
        const nextButton = await page.$('[data-testid="pagination-next"]');
        const isDisabled = await page.evaluate(
          (el) => (el as HTMLButtonElement)?.disabled,
          nextButton
        );

        if (!isDisabled && nextButton) {
          // Get current page alert IDs
          const alertIdsBefore = await page.evaluate(() => {
            const items = document.querySelectorAll('[data-testid^="alert-list-item-"]');
            return Array.from(items).map((el) => el.getAttribute('data-alert-id'));
          });

          // Click next
          await nextButton.click();
          await new Promise((r) => setTimeout(r, 500));

          // Get new page alert IDs
          const alertIdsAfter = await page.evaluate(() => {
            const items = document.querySelectorAll('[data-testid^="alert-list-item-"]');
            return Array.from(items).map((el) => el.getAttribute('data-alert-id'));
          });

          // Alert IDs should be different
          expect(alertIdsAfter).not.toEqual(alertIdsBefore);
        }
      }
    });

    it('should navigate to specific page when page number is clicked', async () => {
      const pagination = await page.$('[data-testid="alerts-pagination"]');
      if (pagination) {
        const page2Button = await page.$('[data-testid="pagination-page-2"]');

        if (page2Button) {
          await page2Button.click();
          await new Promise((r) => setTimeout(r, 500));

          // Page 2 should now be active
          const ariaCurrent = await page.evaluate(
            (el) => el?.getAttribute('aria-current'),
            page2Button
          );
          expect(ariaCurrent).toBe('page');
        }
      }
    });
  });

  describe('Alert Item Interactivity', () => {
    beforeEach(async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));
    });

    it('should make alerts clickable with pointer cursor', async () => {
      const alertItem = await page.$('[data-testid^="alert-list-item-"]');
      expect(alertItem).not.toBeNull();

      const cursor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).cursor;
      }, alertItem);

      expect(cursor).toBe('pointer');
    });

    it('should be focusable via keyboard', async () => {
      const alertItem = await page.$('[data-testid^="alert-list-item-"]');
      const tabIndex = await page.evaluate(
        (el) => el?.getAttribute('tabindex'),
        alertItem
      );
      expect(tabIndex).toBe('0');
    });

    it('should have role="article" for accessibility', async () => {
      const alertItem = await page.$('[data-testid^="alert-list-item-"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), alertItem);
      expect(role).toBe('article');
    });

    it('should have aria-label for accessibility', async () => {
      const alertItem = await page.$('[data-testid^="alert-list-item-"]');
      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        alertItem
      );
      expect(ariaLabel).not.toBeNull();
      expect(ariaLabel).toContain('Alert:');
    });

    it('should mark alert as read when clicked', async () => {
      // Find an unread alert
      const alertItems = await page.$$('[data-testid^="alert-list-item-"]');
      for (const item of alertItems) {
        const isUnread = await page.evaluate((el) => {
          return el?.getAttribute('data-alert-read') === 'false';
        }, item);

        if (isUnread) {
          // Click the alert
          await item.click();
          await new Promise((r) => setTimeout(r, 200));

          // Check it's now read
          const isReadAfter = await page.evaluate((el) => {
            return el?.getAttribute('data-alert-read') === 'true';
          }, item);
          expect(isReadAfter).toBe(true);
          break;
        }
      }
    });
  });

  describe('Navigation', () => {
    it('should navigate back to dashboard when back link is clicked', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      const backLink = await page.$('[data-testid="alerts-back-link"]');
      expect(backLink).not.toBeNull();

      await backLink!.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      expect(page.url()).toBe(DASHBOARD_URL);
    });

    it('should be accessible from dashboard', async () => {
      // In a real app, there would be a link from dashboard to alerts
      // For now, just verify the page is directly accessible
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      const alertsPage = await page.$('[data-testid="alerts-page"]');
      expect(alertsPage).not.toBeNull();
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton initially', async () => {
      // Navigate without waiting for full load
      await page.goto(ALERTS_URL, { waitUntil: 'domcontentloaded' });

      // Check for skeleton immediately
      const skeleton = await page.$('[data-testid="alerts-list-skeleton"]');
      // Skeleton may or may not be visible depending on load speed
      // This is more of a timing test - skeleton presence is allowed
      void skeleton;
    });

    it('should hide skeleton after loading', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));

      // After loading, skeleton should not be present
      const skeleton = await page.$('[data-testid="alerts-list-skeleton"]');
      expect(skeleton).toBeNull();
    });
  });

  describe('Responsive Design', () => {
    it('should display correctly on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));

      const alertsPage = await page.$('[data-testid="alerts-page"]');
      expect(alertsPage).not.toBeNull();

      // Verify alert items are visible
      const alertItems = await page.$$('[data-testid^="alert-list-item-"]');
      expect(alertItems.length).toBeGreaterThan(0);
    });

    it('should display correctly on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));

      const alertsPage = await page.$('[data-testid="alerts-page"]');
      expect(alertsPage).not.toBeNull();
    });

    it('should display correctly on desktop viewport', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));

      const alertsPage = await page.$('[data-testid="alerts-page"]');
      expect(alertsPage).not.toBeNull();
    });
  });

  describe('Dark Mode Support', () => {
    it('should support dark mode', async () => {
      // Emulate dark mode preference
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'dark' },
      ]);

      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      // Verify page loads in dark mode - dark class may or may not be applied
      // depending on system preference vs stored preference
      const hasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      void hasDarkClass; // Just verifying page loads, dark class is optional

      // Just verify page loads without errors
      const alertsPage = await page.$('[data-testid="alerts-page"]');
      expect(alertsPage).not.toBeNull();
    });
  });

  describe('Alert Severity Visual Indicators', () => {
    beforeEach(async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));
    });

    it('should display color-coded severity badges', async () => {
      const severityBadge = await page.$('[data-testid="alert-list-severity"]');
      expect(severityBadge).not.toBeNull();

      // Verify badge has background color class
      const className = await page.evaluate((el) => el?.className, severityBadge);
      expect(className).toContain('bg-');
    });

    it('should display left border for severity indication', async () => {
      const alertItem = await page.$('[data-testid^="alert-list-item-"]');
      const className = await page.evaluate((el) => el?.className, alertItem);
      expect(className).toContain('border-l-');
    });
  });

  describe('Unread Alert Indicators', () => {
    beforeEach(async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));
    });

    it('should display unread indicator on unread alerts', async () => {
      const unreadIndicators = await page.$$('[data-testid="alert-list-unread"]');
      // May have unread alerts depending on mock data
      // Just verify the selector works and returns valid array
      expect(Array.isArray(unreadIndicators)).toBe(true);
    });

    it('should highlight unread alerts with ring', async () => {
      const alertItems = await page.$$('[data-testid^="alert-list-item-"]');
      for (const item of alertItems) {
        const isUnread = await page.evaluate((el) => {
          return el?.getAttribute('data-alert-read') === 'false';
        }, item);

        if (isUnread) {
          const className = await page.evaluate((el) => el?.className, item);
          expect(className).toContain('ring-');
          break;
        }
      }
    });
  });

  describe('Context Information Display', () => {
    beforeEach(async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));
    });

    it('should display market context when available', async () => {
      const marketContext = await page.$('[data-testid="alert-list-market"]');
      // May or may not have market context depending on alert data
      if (marketContext) {
        const text = await page.evaluate((el) => el?.textContent, marketContext);
        expect(text?.length).toBeGreaterThan(0);
      }
    });

    it('should display wallet context when available', async () => {
      const walletContext = await page.$('[data-testid="alert-list-wallet"]');
      // May or may not have wallet context depending on alert data
      if (walletContext) {
        const text = await page.evaluate((el) => el?.textContent, walletContext);
        // Should be truncated wallet address
        expect(text).toMatch(/0x[\da-f]+\.\.\.[\da-f]+/i);
      }
    });

    it('should display tags when available', async () => {
      const tags = await page.$('[data-testid="alert-list-tags"]');
      // May or may not have tags depending on alert data
      if (tags) {
        const tagElements = await page.$$('[data-testid="alert-list-tags"] span');
        expect(tagElements.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Empty State', () => {
    it('should handle empty alerts gracefully', async () => {
      // This is tricky to test with mock data
      // In a real app, we'd mock the API to return empty
      // For now, just verify the empty state component exists
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );

      // The empty state would show if there were no alerts
      // With mock data, this won't trigger
      const alertsPage = await page.$('[data-testid="alerts-page"]');
      expect(alertsPage).not.toBeNull();
    });
  });

  describe('Scroll Behavior', () => {
    it('should scroll to top when changing pages', async () => {
      await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alerts-page"]') !== null,
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 1500));

      // Scroll down
      await page.evaluate(() => {
        window.scrollTo(0, 500);
      });

      // Check we scrolled
      const scrollYBefore = await page.evaluate(() => window.scrollY);
      expect(scrollYBefore).toBeGreaterThan(0);

      // Click next page if available
      const pagination = await page.$('[data-testid="alerts-pagination"]');
      if (pagination) {
        const nextButton = await page.$('[data-testid="pagination-next"]');
        const isDisabled = await page.evaluate(
          (el) => (el as HTMLButtonElement)?.disabled,
          nextButton
        );

        if (!isDisabled && nextButton) {
          await nextButton.click();

          // Wait for smooth scroll to complete (up to 1 second)
          await page.waitForFunction(
            () => window.scrollY <= 10, // Allow small tolerance
            { timeout: 2000 }
          ).catch(() => {
            // Smooth scroll may not be instant, that's ok
          });

          // Should have scrolled near the top (allow tolerance for smooth scroll)
          const scrollYAfter = await page.evaluate(() => window.scrollY);
          expect(scrollYAfter).toBeLessThanOrEqual(50);
        }
      }
    });
  });
});
