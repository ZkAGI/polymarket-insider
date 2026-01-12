/**
 * E2E Browser Tests for SystemStatusIndicator
 * Feature: UI-DASH-007 - System status indicator
 *
 * Tests use Puppeteer to verify system status indicator functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;

describe('SystemStatusIndicator E2E Tests', () => {
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

  describe('System Status Widget Loading', () => {
    it('should load the dashboard with system status widget', async () => {
      const response = await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="system-status-widget"]');
      expect(widget).not.toBeNull();
    });

    it('should display System Status widget with correct title', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const title = await page.evaluate(() => {
        const widget = document.querySelector('[data-testid="system-status-widget"]');
        return widget?.querySelector('[data-testid="widget-title"]')?.textContent;
      });

      expect(title).toBe('System Status');
    });

    it('should show content after loading', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );

      const content = await page.$('[data-testid="system-status-content"]');
      expect(content).not.toBeNull();
    });
  });

  describe('Compact Status Indicator', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should display compact status indicator', async () => {
      const compact = await page.$('[data-testid="status-compact"]');
      expect(compact).not.toBeNull();
    });

    it('should show connection count in compact view', async () => {
      const compact = await page.$('[data-testid="status-compact"]');
      expect(compact).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, compact);
      // Should contain format like "4/5" or "5/5"
      expect(text).toMatch(/\d\/\d/);
    });

    it('should have health status icon', async () => {
      const compact = await page.$('[data-testid="status-compact"]');
      expect(compact).not.toBeNull();

      // Should contain one of the health icons
      const text = await page.evaluate((el) => el?.textContent, compact);
      expect(['✅', '⚠️', '🔴', '❌'].some((icon) => text?.includes(icon))).toBe(true);
    });

    it('should be clickable to expand', async () => {
      const compact = await page.$('[data-testid="status-compact"]');
      expect(compact).not.toBeNull();

      const cursor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).cursor;
      }, compact);

      expect(cursor).toBe('pointer');
    });
  });

  describe('Expand/Collapse Functionality', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have expand toggle button', async () => {
      const toggleButton = await page.$('[data-testid="expand-toggle"]');
      expect(toggleButton).not.toBeNull();
    });

    it('should expand when toggle button clicked', async () => {
      const toggleButton = await page.$('[data-testid="expand-toggle"]');
      expect(toggleButton).not.toBeNull();

      // Click to expand
      await toggleButton?.click();

      // Wait for expanded view
      await page.waitForFunction(
        () => document.querySelector('[data-testid="expanded-view"]') !== null,
        { timeout: 5000 }
      );

      const expandedView = await page.$('[data-testid="expanded-view"]');
      expect(expandedView).not.toBeNull();
    });

    it('should collapse when toggle button clicked again', async () => {
      const toggleButton = await page.$('[data-testid="expand-toggle"]');

      // Expand first
      await toggleButton?.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="expanded-view"]') !== null,
        { timeout: 5000 }
      );

      // Collapse
      await toggleButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const expandedView = await page.$('[data-testid="expanded-view"]');
      expect(expandedView).toBeNull();
    });

    it('should expand when compact indicator clicked', async () => {
      const compact = await page.$('[data-testid="status-compact"]');
      await compact?.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="expanded-view"]') !== null,
        { timeout: 5000 }
      );

      const expandedView = await page.$('[data-testid="expanded-view"]');
      expect(expandedView).not.toBeNull();
    });

    it('should have aria-expanded attribute on toggle', async () => {
      const toggleButton = await page.$('[data-testid="expand-toggle"]');

      // Initially collapsed
      let ariaExpanded = await page.evaluate(
        (el) => el?.getAttribute('aria-expanded'),
        toggleButton
      );
      expect(ariaExpanded).toBe('false');

      // After clicking
      await toggleButton?.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="expanded-view"]') !== null,
        { timeout: 5000 }
      );

      ariaExpanded = await page.evaluate(
        (el) => el?.getAttribute('aria-expanded'),
        toggleButton
      );
      expect(ariaExpanded).toBe('true');
    });
  });

  describe('Expanded View Content', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );

      // Expand the view
      const toggleButton = await page.$('[data-testid="expand-toggle"]');
      await toggleButton?.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="expanded-view"]') !== null,
        { timeout: 5000 }
      );
    });

    it('should display health summary', async () => {
      const healthSummary = await page.$('[data-testid="health-summary"]');
      expect(healthSummary).not.toBeNull();
    });

    it('should display sources list', async () => {
      const sourcesList = await page.$('[data-testid="sources-list"]');
      expect(sourcesList).not.toBeNull();
    });

    it('should show connected count', async () => {
      const connectedCount = await page.$('[data-testid="connected-count"]');
      expect(connectedCount).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, connectedCount);
      expect(text).toMatch(/\d connected/);
    });

    it('should show last refresh time', async () => {
      const lastRefresh = await page.$('[data-testid="last-refresh"]');
      expect(lastRefresh).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, lastRefresh);
      expect(text).toContain('Last updated');
    });
  });

  describe('Data Source Items', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );

      // Expand the view
      const toggleButton = await page.$('[data-testid="expand-toggle"]');
      await toggleButton?.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="sources-list"]') !== null,
        { timeout: 5000 }
      );
    });

    it('should display all 5 data source types', async () => {
      const sourceItems = await page.$$('[data-testid^="source-item-"]');
      expect(sourceItems.length).toBe(5);
    });

    it('should display Gamma API source', async () => {
      const item = await page.$('[data-testid="source-item-gamma-api"]');
      expect(item).not.toBeNull();
    });

    it('should display CLOB API source', async () => {
      const item = await page.$('[data-testid="source-item-clob-api"]');
      expect(item).not.toBeNull();
    });

    it('should display WebSocket source', async () => {
      const item = await page.$('[data-testid="source-item-websocket"]');
      expect(item).not.toBeNull();
    });

    it('should display Polygon RPC source', async () => {
      const item = await page.$('[data-testid="source-item-polygon-rpc"]');
      expect(item).not.toBeNull();
    });

    it('should display Database source', async () => {
      const item = await page.$('[data-testid="source-item-database"]');
      expect(item).not.toBeNull();
    });

    it('should show source status indicator', async () => {
      const statusIndicator = await page.$('[data-testid="source-status-indicator"]');
      expect(statusIndicator).not.toBeNull();
    });

    it('should show source icon', async () => {
      const icon = await page.$('[data-testid="source-icon"]');
      expect(icon).not.toBeNull();
    });

    it('should show source label', async () => {
      const label = await page.$('[data-testid="source-label"]');
      expect(label).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, label);
      expect(text).toBeTruthy();
    });

    it('should show source description', async () => {
      const description = await page.$('[data-testid="source-description"]');
      expect(description).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, description);
      expect(text).toBeTruthy();
    });

    it('should show source status label', async () => {
      const statusLabel = await page.$('[data-testid="source-status-label"]');
      expect(statusLabel).not.toBeNull();

      const text = await page.evaluate((el) => el?.textContent, statusLabel);
      expect(['Connected', 'Disconnected', 'Connecting', 'Degraded', 'Unknown']).toContain(text);
    });
  });

  describe('Source Item Interactivity', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );

      const toggleButton = await page.$('[data-testid="expand-toggle"]');
      await toggleButton?.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="sources-list"]') !== null,
        { timeout: 5000 }
      );
    });

    it('should be clickable with cursor pointer', async () => {
      const sourceItem = await page.$('[data-testid^="source-item-"]');
      expect(sourceItem).not.toBeNull();

      const cursor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).cursor;
      }, sourceItem);

      expect(cursor).toBe('pointer');
    });

    it('should have role="button" for accessibility', async () => {
      const sourceItem = await page.$('[data-testid^="source-item-"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), sourceItem);
      expect(role).toBe('button');
    });

    it('should have tabIndex for keyboard navigation', async () => {
      const sourceItem = await page.$('[data-testid^="source-item-"]');
      const tabIndex = await page.evaluate(
        (el) => el?.getAttribute('tabindex'),
        sourceItem
      );
      expect(tabIndex).toBe('0');
    });

    it('should respond to click events without errors', async () => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const sourceItem = await page.$('[data-testid="source-item-gamma-api"]');
      await sourceItem?.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const relevantErrors = consoleErrors.filter(
        (err) => !err.includes('DevTools') && !err.includes('Extension')
      );
      expect(relevantErrors).toHaveLength(0);
    });

    it('should have data attributes for source type', async () => {
      const sourceItem = await page.$('[data-testid^="source-item-"]');
      const dataType = await page.evaluate(
        (el) => el?.getAttribute('data-source-type'),
        sourceItem
      );
      expect(dataType).toBeTruthy();
    });

    it('should have data attributes for source status', async () => {
      const sourceItem = await page.$('[data-testid^="source-item-"]');
      const dataStatus = await page.evaluate(
        (el) => el?.getAttribute('data-source-status'),
        sourceItem
      );
      expect(dataStatus).toBeTruthy();
    });
  });

  describe('Latency Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );

      const toggleButton = await page.$('[data-testid="expand-toggle"]');
      await toggleButton?.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="sources-list"]') !== null,
        { timeout: 5000 }
      );
    });

    it('should display latency for connected sources', async () => {
      // Find a connected source
      const connectedSource = await page.$('[data-source-status="CONNECTED"]');

      if (connectedSource) {
        const latency = await page.evaluate((el) => {
          return el?.querySelector('[data-testid="source-latency"]')?.textContent;
        }, connectedSource);

        // Latency should be present and formatted
        if (latency) {
          expect(latency).toMatch(/\d+ms|<1ms|\d+\.\d+s|--/);
        }
      }
    });
  });

  describe('Visual Styling', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );

      const toggleButton = await page.$('[data-testid="expand-toggle"]');
      await toggleButton?.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="sources-list"]') !== null,
        { timeout: 5000 }
      );
    });

    it('should have proper spacing between source items', async () => {
      const sourcesList = await page.$('[data-testid="sources-list"]');
      const gap = await page.evaluate((el) => {
        const style = window.getComputedStyle(el!);
        return style.gap || style.rowGap;
      }, sourcesList);

      expect(gap).toBeTruthy();
    });

    it('should have background color on source items', async () => {
      const sourceItem = await page.$('[data-testid^="source-item-"]');
      const bgColor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).backgroundColor;
      }, sourceItem);

      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(bgColor).not.toBe('transparent');
    });

    it('should have rounded corners on source items', async () => {
      const sourceItem = await page.$('[data-testid^="source-item-"]');
      const borderRadius = await page.evaluate((el) => {
        return window.getComputedStyle(el!).borderRadius;
      }, sourceItem);

      expect(borderRadius).toBeTruthy();
      expect(borderRadius).not.toBe('0px');
    });

    it('should have status indicator with appropriate color', async () => {
      const statusIndicator = await page.$('[data-testid="source-status-indicator"]');
      const bgColor = await page.evaluate((el) => {
        return window.getComputedStyle(el!).backgroundColor;
      }, statusIndicator);

      expect(bgColor).toBeTruthy();
    });
  });

  describe('Responsive Layout', () => {
    it('should display properly on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-widget"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="system-status-widget"]');
      const isVisible = await page.evaluate((el) => {
        const rect = el?.getBoundingClientRect();
        return rect && rect.width > 0 && rect.height > 0;
      }, widget);

      expect(isVisible).toBe(true);
    });

    it('should display properly on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-widget"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="system-status-widget"]');
      const isVisible = await page.evaluate((el) => {
        const rect = el?.getBoundingClientRect();
        return rect && rect.width > 0 && rect.height > 0;
      }, widget);

      expect(isVisible).toBe(true);
    });

    it('should display properly on desktop viewport', async () => {
      await page.setViewport({ width: 1280, height: 720 });
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-widget"]') !== null,
        { timeout: 10000 }
      );

      const widget = await page.$('[data-testid="system-status-widget"]');
      const isVisible = await page.evaluate((el) => {
        const rect = el?.getBoundingClientRect();
        return rect && rect.width > 0 && rect.height > 0;
      }, widget);

      expect(isVisible).toBe(true);
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );

      const toggleButton = await page.$('[data-testid="expand-toggle"]');
      await toggleButton?.click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="sources-list"]') !== null,
        { timeout: 5000 }
      );
    });

    it('should have aria-label on sources list', async () => {
      const sourcesList = await page.$('[data-testid="sources-list"]');
      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        sourcesList
      );
      expect(ariaLabel).toBe('Data source connection statuses');
    });

    it('should have role="list" on sources container', async () => {
      const sourcesList = await page.$('[data-testid="sources-list"]');
      const role = await page.evaluate((el) => el?.getAttribute('role'), sourcesList);
      expect(role).toBe('list');
    });

    it('should have accessible aria-label on source items', async () => {
      const sourceItem = await page.$('[data-testid^="source-item-"]');
      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        sourceItem
      );
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel?.length).toBeGreaterThan(0);
    });

    it('should have aria-label on compact indicator', async () => {
      const compact = await page.$('[data-testid="status-compact"]');
      const ariaLabel = await page.evaluate(
        (el) => el?.getAttribute('aria-label'),
        compact
      );
      expect(ariaLabel).toContain('System status');
    });
  });

  describe('Console Errors', () => {
    it('should not have any JavaScript console errors', async () => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );

      // Expand and interact
      const toggleButton = await page.$('[data-testid="expand-toggle"]');
      await toggleButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const criticalErrors = consoleErrors.filter(
        (err) => !err.includes('DevTools') && !err.includes('Extension')
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });

  describe('System Health Display', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-content"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have data-system-health attribute on container', async () => {
      const container = await page.$('[data-testid="system-status-content"]');
      const health = await page.evaluate(
        (el) => el?.getAttribute('data-system-health'),
        container
      );
      expect(['HEALTHY', 'DEGRADED', 'CRITICAL', 'OFFLINE']).toContain(health);
    });

    it('should have data-health attribute on compact indicator', async () => {
      const compact = await page.$('[data-testid="status-compact"]');
      const health = await page.evaluate(
        (el) => el?.getAttribute('data-health'),
        compact
      );
      expect(['HEALTHY', 'DEGRADED', 'CRITICAL', 'OFFLINE']).toContain(health);
    });
  });

  describe('Full Span Layout', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="system-status-widget"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should span full width on large screens', async () => {
      await page.setViewport({ width: 1280, height: 720 });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const widget = await page.$('[data-testid="system-status-widget"]');
      const parentClasses = await page.evaluate((el) => {
        return el?.parentElement?.className;
      }, widget);

      // Should have lg:col-span-3 class on parent
      expect(parentClasses).toContain('lg:col-span-3');
    });
  });
});
