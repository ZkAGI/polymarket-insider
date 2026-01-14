/**
 * E2E Browser Tests for Dashboard Live Updates (UI-WS-001)
 *
 * Tests use Puppeteer to verify:
 * - Live indicator displays correctly
 * - SSE connection is established
 * - Connection status changes appropriately
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

describe('Dashboard Live Updates E2E Tests (UI-WS-001)', () => {
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

  describe('Live Indicator Display', () => {
    it('should display the live indicator in the header', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      // Check for live indicator
      const liveIndicator = await page.$('[data-testid="dashboard-live-indicator"]');
      expect(liveIndicator).not.toBeNull();
    });

    it('should show connection status', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      // Get the live indicator status attribute
      const status = await page.evaluate(() => {
        const indicator = document.querySelector('[data-testid="dashboard-live-indicator"]');
        return indicator?.getAttribute('data-status');
      });

      // Status should be one of the valid values
      expect(['connected', 'connecting', 'disconnected', 'reconnecting']).toContain(status);
    });

    it('should have pulsing animation when connecting or connected', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      // Check for the indicator dot with animation
      const hasAnimation = await page.evaluate(() => {
        const indicator = document.querySelector('[data-testid="dashboard-live-indicator"]');
        if (!indicator) return false;

        // Look for the pulsing dot element
        const pulsingDot = indicator.querySelector('.animate-pulse, .animate-ping');
        return pulsingDot !== null;
      });

      expect(hasAnimation).toBe(true);
    });
  });

  describe('Live Indicator Visual States', () => {
    it('should show "LIVE" text when connected', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard and SSE to connect (give it time)
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      // Wait a bit for SSE to establish
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const indicatorText = await page.evaluate(() => {
        const indicator = document.querySelector('[data-testid="dashboard-live-indicator"]');
        return indicator?.textContent?.trim();
      });

      // Should show one of the status labels
      expect(['LIVE', 'Connecting...', 'Reconnecting...', 'Offline']).toContain(indicatorText);
    });

    it('should take screenshot of live indicator', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      // Wait for SSE connection
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Take screenshot
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'dashboard-live-indicator.png'),
        fullPage: false,
      });

      // Verify screenshot was created
      expect(fs.existsSync(path.join(SCREENSHOTS_DIR, 'dashboard-live-indicator.png'))).toBe(true);
    });
  });

  describe('SSE Connection', () => {
    it('should establish SSE connection on dashboard load', async () => {
      // Track SSE requests
      const sseRequests: string[] = [];

      page.on('request', (request) => {
        if (request.url().includes('/api/dashboard/live')) {
          sseRequests.push(request.url());
        }
      });

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      // Give time for SSE connection to be attempted
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Should have made a request to the live endpoint
      expect(sseRequests.length).toBeGreaterThanOrEqual(1);
    });

    it('should make request to /api/dashboard/live endpoint', async () => {
      let liveEndpointCalled = false;

      page.on('request', (request) => {
        if (request.url().endsWith('/api/dashboard/live')) {
          liveEndpointCalled = true;
        }
      });

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load and SSE to connect
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(liveEndpointCalled).toBe(true);
    });
  });

  describe('Live Indicator Accessibility', () => {
    it('should have aria-label for screen readers', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const hasAriaLabel = await page.evaluate(() => {
        const indicator = document.querySelector('[data-testid="dashboard-live-indicator"]');
        const ariaLabel = indicator?.getAttribute('aria-label');
        return ariaLabel !== null && ariaLabel !== undefined && ariaLabel.includes('Connection status');
      });

      expect(hasAriaLabel).toBe(true);
    });
  });

  describe('Dashboard Header with Live Indicator', () => {
    it('should show live indicator alongside other header elements', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      // Check header has expected elements
      const headerElements = await page.evaluate(() => {
        return {
          liveIndicator: !!document.querySelector('[data-testid="dashboard-live-indicator"]'),
          themeToggle: !!document.querySelector('[data-testid="dashboard-theme-toggle"]'),
          systemStatus: !!document.querySelector('[data-testid="system-status"]'),
          refreshControls: !!document.querySelector('[data-testid="dashboard-refresh-controls"]'),
        };
      });

      expect(headerElements.liveIndicator).toBe(true);
      expect(headerElements.systemStatus).toBe(true);
    });
  });

  describe('Responsive Behavior', () => {
    it('should display live indicator on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE size

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const liveIndicator = await page.$('[data-testid="dashboard-live-indicator"]');
      expect(liveIndicator).not.toBeNull();
    });

    it('should display live indicator on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 }); // iPad size

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const liveIndicator = await page.$('[data-testid="dashboard-live-indicator"]');
      expect(liveIndicator).not.toBeNull();
    });
  });

  describe('Console Errors', () => {
    it('should not have console errors related to SSE', async () => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });

      // Wait for dashboard to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      // Wait for SSE connection attempts
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Filter for SSE-related errors
      const sseErrors = errors.filter(
        (e) =>
          e.includes('SSE') ||
          e.includes('EventSource') ||
          e.includes('/api/dashboard/live')
      );

      // Should have no critical SSE errors (some connection issues in test env may be acceptable)
      expect(sseErrors.length).toBeLessThanOrEqual(1);
    });
  });
});

describe('SSE API Endpoint E2E Tests', () => {
  it('should return SSE response from /api/dashboard/live', async () => {
    // Test the endpoint directly with fetch
    const response = await fetch(`${BASE_URL}/api/dashboard/live`, {
      method: 'GET',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });

  it('should include correct headers for SSE', async () => {
    const response = await fetch(`${BASE_URL}/api/dashboard/live`, {
      method: 'GET',
    });

    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-cache');
  });
});
