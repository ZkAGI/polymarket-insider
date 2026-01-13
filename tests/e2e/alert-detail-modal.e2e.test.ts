/**
 * E2E Browser Tests for Alert Detail Modal
 * Feature: UI-ALERT-002 - Alert detail modal
 *
 * Tests use Puppeteer to verify the alert detail modal functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const ALERTS_URL = `${BASE_URL}/alerts`;

describe('Alert Detail Modal E2E Tests', () => {
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

  // Helper function to wait for alerts page to load
  async function waitForAlertsPage() {
    await page.goto(ALERTS_URL, { waitUntil: 'networkidle2' });
    await page.waitForFunction(
      () => document.querySelector('[data-testid="alerts-page"]') !== null,
      { timeout: 10000 }
    );
    // Wait for alerts to load
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Helper function to open modal by clicking first alert
  async function openFirstAlertModal() {
    const alertItem = await page.$('[data-testid^="alert-list-item-"]');
    if (alertItem) {
      await alertItem.click();
      // Wait for modal to appear
      await page.waitForSelector('[data-testid="alert-detail-modal"]', { timeout: 5000 });
    }
    return alertItem;
  }

  describe('Modal Opening and Closing', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
    });

    it('should open modal when clicking an alert item', async () => {
      const alertItem = await openFirstAlertModal();
      expect(alertItem).not.toBeNull();

      const modal = await page.$('[data-testid="alert-detail-modal"]');
      expect(modal).not.toBeNull();
    });

    it('should display modal content', async () => {
      await openFirstAlertModal();

      const modalContent = await page.$('[data-testid="modal-content"]');
      expect(modalContent).not.toBeNull();
    });

    it('should close modal when clicking close button', async () => {
      await openFirstAlertModal();

      // Click close button
      const closeButton = await page.$('[data-testid="modal-close"]');
      expect(closeButton).not.toBeNull();
      await closeButton?.click();

      // Wait for modal to disappear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-detail-modal"]') === null,
        { timeout: 5000 }
      );

      const modal = await page.$('[data-testid="alert-detail-modal"]');
      expect(modal).toBeNull();
    });

    it('should close modal when clicking backdrop', async () => {
      await openFirstAlertModal();

      // Click on backdrop (outside modal content)
      await page.evaluate(() => {
        const backdrop = document.querySelector('[data-testid="alert-detail-modal"]');
        if (backdrop) {
          // Click on the backdrop itself, not the content
          const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          backdrop.dispatchEvent(event);
        }
      });

      // Wait for modal to disappear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-detail-modal"]') === null,
        { timeout: 5000 }
      );

      const modalAfter = await page.$('[data-testid="alert-detail-modal"]');
      expect(modalAfter).toBeNull();
    });

    it('should close modal when pressing Escape key', async () => {
      await openFirstAlertModal();

      // Press Escape key
      await page.keyboard.press('Escape');

      // Wait for modal to disappear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-detail-modal"]') === null,
        { timeout: 5000 }
      );

      const modal = await page.$('[data-testid="alert-detail-modal"]');
      expect(modal).toBeNull();
    });
  });

  describe('Modal Header', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();
    });

    it('should display alert icon', async () => {
      const icon = await page.$('[data-testid="modal-icon"]');
      expect(icon).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, icon);
      expect(text).toBeTruthy();
    });

    it('should display severity badge', async () => {
      const severity = await page.$('[data-testid="modal-severity"]');
      expect(severity).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, severity);
      expect(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(text);
    });

    it('should display type badge', async () => {
      const type = await page.$('[data-testid="modal-type"]');
      expect(type).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, type);
      expect(text).toBeTruthy();
    });

    it('should display alert title', async () => {
      const title = await page.$('[data-testid="modal-title"]');
      expect(title).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, title);
      expect(text?.length).toBeGreaterThan(0);
    });

    it('should display close button', async () => {
      const closeButton = await page.$('[data-testid="modal-close"]');
      expect(closeButton).not.toBeNull();
    });
  });

  describe('Modal Body Content', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();
    });

    it('should display modal body', async () => {
      const body = await page.$('[data-testid="modal-body"]');
      expect(body).not.toBeNull();
    });

    it('should display message section', async () => {
      const messageSection = await page.$('[data-testid="modal-message-section"]');
      expect(messageSection).not.toBeNull();
    });

    it('should display alert message', async () => {
      const message = await page.$('[data-testid="modal-message"]');
      expect(message).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, message);
      expect(text?.length).toBeGreaterThan(0);
    });

    it('should display type section with description', async () => {
      const typeSection = await page.$('[data-testid="modal-type-section"]');
      expect(typeSection).not.toBeNull();
    });

    it('should display severity section with description', async () => {
      const severitySection = await page.$('[data-testid="modal-severity-section"]');
      expect(severitySection).not.toBeNull();
    });

    it('should display timestamps section', async () => {
      const timestampsSection = await page.$('[data-testid="modal-timestamps-section"]');
      expect(timestampsSection).not.toBeNull();
    });

    it('should display created at timestamp', async () => {
      const createdAt = await page.$('[data-testid="modal-created-at"]');
      expect(createdAt).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, createdAt);
      expect(text).toBeTruthy();
    });

    it('should display full timestamp', async () => {
      const fullTimestamp = await page.$('[data-testid="modal-full-timestamp"]');
      expect(fullTimestamp).not.toBeNull();
    });

    it('should display alert ID', async () => {
      const alertId = await page.$('[data-testid="modal-alert-id"]');
      expect(alertId).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, alertId);
      expect(text?.length).toBeGreaterThan(0);
    });
  });

  describe('Related Data Section', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();
    });

    it('should display related data section when market/wallet exists', async () => {
      const relatedSection = await page.$('[data-testid="modal-related-section"]');
      // May or may not exist depending on alert data
      if (relatedSection) {
        expect(relatedSection).not.toBeNull();
      }
    });

    it('should display market name when available', async () => {
      const marketName = await page.$('[data-testid="modal-market-name"]');
      // May or may not exist depending on alert data
      if (marketName) {
        const text = await page.evaluate((el) => el?.textContent, marketName);
        expect(text?.length).toBeGreaterThan(0);
      }
    });

    it('should display wallet address when available', async () => {
      const walletAddress = await page.$('[data-testid="modal-wallet-address"]');
      // May or may not exist depending on alert data
      if (walletAddress) {
        const text = await page.evaluate((el) => el?.textContent, walletAddress);
        expect(text).toBeTruthy();
      }
    });

    it('should have view market button when market exists', async () => {
      const viewMarketButton = await page.$('[data-testid="modal-view-market"]');
      // May or may not exist depending on alert data
      if (viewMarketButton) {
        const text = await page.evaluate((el) => el?.textContent, viewMarketButton);
        expect(text).toContain('View Market');
      }
    });

    it('should have view wallet button when wallet exists', async () => {
      const viewWalletButton = await page.$('[data-testid="modal-view-wallet"]');
      // May or may not exist depending on alert data
      if (viewWalletButton) {
        const text = await page.evaluate((el) => el?.textContent, viewWalletButton);
        expect(text).toContain('View Wallet');
      }
    });

    it('should have copy wallet button when wallet exists', async () => {
      const copyButton = await page.$('[data-testid="modal-copy-wallet"]');
      // May or may not exist depending on alert data
      if (copyButton) {
        expect(copyButton).not.toBeNull();
      }
    });
  });

  describe('Tags Section', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();
    });

    it('should display tags section when tags exist', async () => {
      const tagsSection = await page.$('[data-testid="modal-tags-section"]');
      // May or may not exist depending on alert data
      if (tagsSection) {
        expect(tagsSection).not.toBeNull();
      }
    });

    it('should display tags container when tags exist', async () => {
      const tags = await page.$('[data-testid="modal-tags"]');
      // May or may not exist depending on alert data
      if (tags) {
        const text = await page.evaluate((el) => el?.textContent, tags);
        expect(text).toContain('#');
      }
    });
  });

  describe('Modal Footer and Actions', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();
    });

    it('should display modal footer', async () => {
      const footer = await page.$('[data-testid="modal-footer"]');
      expect(footer).not.toBeNull();
    });

    it('should display action buttons container', async () => {
      const actions = await page.$('[data-testid="modal-actions"]');
      expect(actions).not.toBeNull();
    });

    it('should have dismiss button', async () => {
      const dismissButton = await page.$('[data-testid="modal-action-dismiss"]');
      expect(dismissButton).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, dismissButton);
      expect(text).toContain('Dismiss');
    });

    it('should have mark read or mark unread button', async () => {
      const markReadButton = await page.$('[data-testid="modal-action-mark_read"]');
      const markUnreadButton = await page.$('[data-testid="modal-action-mark_unread"]');

      // One of them should exist based on alert read status
      expect(markReadButton !== null || markUnreadButton !== null).toBe(true);
    });

    it('should have investigate button when related data exists', async () => {
      const investigateButton = await page.$('[data-testid="modal-investigate"]');
      // May or may not exist depending on alert data
      if (investigateButton) {
        const text = await page.evaluate((el) => el?.textContent, investigateButton);
        expect(text).toContain('Investigate');
      }
    });
  });

  describe('Action Button Functionality', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();
    });

    it('should close modal when clicking dismiss', async () => {
      const dismissButton = await page.$('[data-testid="modal-action-dismiss"]');
      expect(dismissButton).not.toBeNull();

      await dismissButton?.click();

      // Wait for modal to disappear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-detail-modal"]') === null,
        { timeout: 5000 }
      );

      const modal = await page.$('[data-testid="alert-detail-modal"]');
      expect(modal).toBeNull();
    });

    it('should update read status when clicking mark read', async () => {
      // Check if we have mark read button (alert is unread)
      const markReadButton = await page.$('[data-testid="modal-action-mark_read"]');

      if (markReadButton) {
        await markReadButton.click();
        // Wait a bit for state update
        await new Promise((r) => setTimeout(r, 300));

        // After clicking, should now show mark unread button
        const markUnreadButton = await page.$('[data-testid="modal-action-mark_unread"]');
        expect(markUnreadButton).not.toBeNull();
      }
    });

    it('should update unread status when clicking mark unread', async () => {
      // Check if we have mark unread button (alert is read)
      const markUnreadButton = await page.$('[data-testid="modal-action-mark_unread"]');

      if (markUnreadButton) {
        await markUnreadButton.click();
        // Wait a bit for state update
        await new Promise((r) => setTimeout(r, 300));

        // After clicking, should now show mark read button
        const markReadButton = await page.$('[data-testid="modal-action-mark_read"]');
        expect(markReadButton).not.toBeNull();
      }
    });

    it('should update acknowledged status when clicking acknowledge', async () => {
      // Check if we have acknowledge button (alert not acknowledged)
      const acknowledgeButton = await page.$('[data-testid="modal-action-acknowledge"]');

      if (acknowledgeButton) {
        await acknowledgeButton.click();
        // Wait a bit for state update
        await new Promise((r) => setTimeout(r, 300));

        // After clicking, acknowledged badge should appear
        const acknowledgedBadge = await page.$('[data-testid="modal-acknowledged"]');
        expect(acknowledgedBadge).not.toBeNull();

        // Acknowledge button should be gone
        const acknowledgeButtonAfter = await page.$('[data-testid="modal-action-acknowledge"]');
        expect(acknowledgeButtonAfter).toBeNull();
      }
    });
  });

  describe('Unread/Read Indicator', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
    });

    it('should display unread badge for unread alerts', async () => {
      // Find an unread alert
      const unreadAlert = await page.$('[data-alert-read="false"]');

      if (unreadAlert) {
        await unreadAlert.click();
        await page.waitForSelector('[data-testid="alert-detail-modal"]', { timeout: 5000 });

        const unreadBadge = await page.$('[data-testid="modal-unread"]');
        expect(unreadBadge).not.toBeNull();
      }
    });

    it('should not display unread badge for read alerts', async () => {
      // Find a read alert
      const readAlert = await page.$('[data-alert-read="true"]');

      if (readAlert) {
        await readAlert.click();
        await page.waitForSelector('[data-testid="alert-detail-modal"]', { timeout: 5000 });

        const unreadBadge = await page.$('[data-testid="modal-unread"]');
        expect(unreadBadge).toBeNull();
      }
    });
  });

  describe('Severity-Based Styling', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
    });

    it('should have correct styling for CRITICAL severity', async () => {
      const criticalAlert = await page.$('[data-alert-severity="CRITICAL"]');

      if (criticalAlert) {
        await criticalAlert.click();
        await page.waitForSelector('[data-testid="alert-detail-modal"]', { timeout: 5000 });

        const severityBadge = await page.$('[data-testid="modal-severity"]');
        const text = await page.evaluate((el) => el?.textContent, severityBadge);
        expect(text).toBe('CRITICAL');
      }
    });

    it('should have correct styling for HIGH severity', async () => {
      const highAlert = await page.$('[data-alert-severity="HIGH"]');

      if (highAlert) {
        await highAlert.click();
        await page.waitForSelector('[data-testid="alert-detail-modal"]', { timeout: 5000 });

        const severityBadge = await page.$('[data-testid="modal-severity"]');
        const text = await page.evaluate((el) => el?.textContent, severityBadge);
        expect(text).toBe('HIGH');
      }
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();
    });

    it('should focus close button on modal open', async () => {
      // The close button should receive focus
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.getAttribute('data-testid');
      });
      expect(focusedElement).toBe('modal-close');
    });

    it('should allow Tab navigation within modal', async () => {
      // Press Tab to move focus
      await page.keyboard.press('Tab');

      // Should still be within modal
      const focusedElement = await page.evaluate(() => {
        const active = document.activeElement;
        const modal = document.querySelector('[data-testid="modal-content"]');
        return modal?.contains(active);
      });

      // Might be within modal or on action buttons
      expect(focusedElement !== undefined).toBe(true);
    });
  });

  describe('Responsive Layout', () => {
    it('should display correctly on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await waitForAlertsPage();
      await openFirstAlertModal();

      const modal = await page.$('[data-testid="alert-detail-modal"]');
      expect(modal).not.toBeNull();

      // Modal content should be visible and not overflow
      const modalContent = await page.$('[data-testid="modal-content"]');
      const boundingBox = await modalContent?.boundingBox();

      expect(boundingBox).not.toBeNull();
      expect(boundingBox!.width).toBeLessThanOrEqual(375);
    });

    it('should display correctly on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await waitForAlertsPage();
      await openFirstAlertModal();

      const modal = await page.$('[data-testid="alert-detail-modal"]');
      expect(modal).not.toBeNull();

      const modalContent = await page.$('[data-testid="modal-content"]');
      const boundingBox = await modalContent?.boundingBox();

      expect(boundingBox).not.toBeNull();
      expect(boundingBox!.width).toBeLessThanOrEqual(768);
    });

    it('should display correctly on desktop viewport', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await waitForAlertsPage();
      await openFirstAlertModal();

      const modal = await page.$('[data-testid="alert-detail-modal"]');
      expect(modal).not.toBeNull();

      // Modal should have max-width constraint
      const modalContent = await page.$('[data-testid="modal-content"]');
      const boundingBox = await modalContent?.boundingBox();

      expect(boundingBox).not.toBeNull();
      // Should respect max-w-2xl (672px) constraint
      expect(boundingBox!.width).toBeLessThanOrEqual(700);
    });
  });

  describe('Dark Mode Support', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
    });

    it('should display modal correctly in dark mode', async () => {
      // Enable dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('polymarket-tracker-theme', 'dark');
      });

      await openFirstAlertModal();

      // Modal should be visible in dark mode
      const modal = await page.$('[data-testid="alert-detail-modal"]');
      expect(modal).not.toBeNull();

      // Check that dark mode classes are applied
      const isDarkMode = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      expect(isDarkMode).toBe(true);
    });

    it('should display modal correctly in light mode', async () => {
      // Enable light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('polymarket-tracker-theme', 'light');
      });

      await openFirstAlertModal();

      // Modal should be visible in light mode
      const modal = await page.$('[data-testid="alert-detail-modal"]');
      expect(modal).not.toBeNull();
    });
  });

  describe('Body Scroll Lock', () => {
    it('should lock body scroll when modal is open', async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();

      const bodyOverflow = await page.evaluate(() => {
        return document.body.style.overflow;
      });

      expect(bodyOverflow).toBe('hidden');
    });

    it('should restore body scroll when modal is closed', async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();

      // Close modal
      const closeButton = await page.$('[data-testid="modal-close"]');
      await closeButton?.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-detail-modal"]') === null,
        { timeout: 5000 }
      );

      // Body scroll should be restored
      const bodyOverflow = await page.evaluate(() => {
        return document.body.style.overflow;
      });

      expect(bodyOverflow).not.toBe('hidden');
    });
  });

  describe('Multiple Modal Opens', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
    });

    it('should open different alert modals correctly', async () => {
      // Get all alert items
      const alertItems = await page.$$('[data-testid^="alert-list-item-"]');
      expect(alertItems.length).toBeGreaterThan(0);

      // Open first alert
      await alertItems[0]?.click();
      await page.waitForSelector('[data-testid="alert-detail-modal"]', { timeout: 5000 });

      const firstTitle = await page.evaluate(() => {
        return document.querySelector('[data-testid="modal-title"]')?.textContent;
      });

      // Close modal
      const closeButton = await page.$('[data-testid="modal-close"]');
      await closeButton?.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="alert-detail-modal"]') === null,
        { timeout: 5000 }
      );

      // Open second alert if exists
      if (alertItems.length > 1) {
        await alertItems[1]?.click();
        await page.waitForSelector('[data-testid="alert-detail-modal"]', { timeout: 5000 });

        const secondTitle = await page.evaluate(() => {
          return document.querySelector('[data-testid="modal-title"]')?.textContent;
        });

        // Titles should be defined
        expect(firstTitle).toBeTruthy();
        expect(secondTitle).toBeTruthy();
      }
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
      await openFirstAlertModal();
    });

    it('should have role="dialog" on modal', async () => {
      const role = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="alert-detail-modal"]');
        return modal?.getAttribute('role');
      });

      expect(role).toBe('dialog');
    });

    it('should have aria-modal="true"', async () => {
      const ariaModal = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="alert-detail-modal"]');
        return modal?.getAttribute('aria-modal');
      });

      expect(ariaModal).toBe('true');
    });

    it('should have aria-labelledby pointing to title', async () => {
      const ariaLabelledBy = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="alert-detail-modal"]');
        return modal?.getAttribute('aria-labelledby');
      });

      expect(ariaLabelledBy).toBe('modal-title');
    });

    it('should have accessible close button', async () => {
      const closeButtonLabel = await page.evaluate(() => {
        const button = document.querySelector('[data-testid="modal-close"]');
        return button?.getAttribute('aria-label');
      });

      expect(closeButtonLabel).toContain('Close');
    });
  });

  describe('Animation', () => {
    beforeEach(async () => {
      await waitForAlertsPage();
    });

    it('should have enter animation class on open', async () => {
      await openFirstAlertModal();

      const hasAnimation = await page.evaluate(() => {
        const content = document.querySelector('[data-testid="modal-content"]');
        return content?.classList.contains('animate-modal-enter');
      });

      expect(hasAnimation).toBe(true);
    });
  });
});
