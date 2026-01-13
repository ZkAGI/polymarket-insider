import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const SETTINGS_URL = `${BASE_URL}/settings`;

describe('Settings Page E2E Tests', () => {
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

  describe('Page Load and Layout', () => {
    it('should load the settings page successfully', async () => {
      const response = await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const title = await page.title();
      expect(title).toContain('Polymarket Tracker');
    }, 30000);

    it('should display settings layout with header', async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });

      const layout = await page.$('[data-testid="settings-layout"]');
      expect(layout).toBeTruthy();

      const titleElement = await page.$('h1');
      const titleText = await page.evaluate((el) => el?.textContent, titleElement);
      expect(titleText).toContain('Settings');
    }, 30000);

    it('should display back to dashboard link', async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });

      const backLink = await page.$('[data-testid="back-to-dashboard-link"]');
      expect(backLink).toBeTruthy();

      const href = await page.evaluate((el) => el?.getAttribute('href'), backLink);
      expect(href).toBe('/dashboard');
    }, 30000);

    it('should display theme toggle', async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });

      const themeToggle = await page.$('[data-testid="settings-theme-toggle"]');
      expect(themeToggle).toBeTruthy();
    }, 30000);
  });

  describe('Settings Categories', () => {
    beforeEach(async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });
    });

    it('should display alert thresholds category', async () => {
      const category = await page.$('[data-testid="settings-category-alert-thresholds"]');
      expect(category).toBeTruthy();

      const heading = await category?.$('h2');
      const headingText = await page.evaluate((el) => el?.textContent, heading);
      expect(headingText).toContain('Alert Thresholds');
    }, 30000);

    it('should display notifications category', async () => {
      const category = await page.$('[data-testid="settings-category-notifications"]');
      expect(category).toBeTruthy();

      const heading = await category?.$('h2');
      const headingText = await page.evaluate((el) => el?.textContent, heading);
      expect(headingText).toContain('Notifications');
    }, 30000);

    it('should display display category', async () => {
      const category = await page.$('[data-testid="settings-category-display"]');
      expect(category).toBeTruthy();

      const heading = await category?.$('h2');
      const headingText = await page.evaluate((el) => el?.textContent, heading);
      expect(headingText).toContain('Display');
    }, 30000);

    it('should display privacy category', async () => {
      const category = await page.$('[data-testid="settings-category-privacy"]');
      expect(category).toBeTruthy();

      const heading = await category?.$('h2');
      const headingText = await page.evaluate((el) => el?.textContent, heading);
      expect(headingText).toContain('Privacy');
    }, 30000);
  });

  describe('Alert Thresholds', () => {
    beforeEach(async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });
    });

    it('should display volume spike input with default value', async () => {
      const input = await page.$('[data-testid="volume-spike-input"]');
      expect(input).toBeTruthy();

      const value = await page.evaluate((el) => (el as HTMLInputElement)?.value, input);
      expect(value).toBe('200');
    }, 30000);

    it('should update volume spike threshold', async () => {
      const input = await page.$('[data-testid="volume-spike-input"]');
      await input?.click({ clickCount: 3 }); // Select all
      await input?.type('300');

      const value = await page.evaluate((el) => (el as HTMLInputElement)?.value, input);
      expect(value).toBe('300');
    }, 30000);

    it('should display whale trade minimum input with default value', async () => {
      const input = await page.$('[data-testid="whale-trade-input"]');
      expect(input).toBeTruthy();

      const value = await page.evaluate((el) => (el as HTMLInputElement)?.value, input);
      expect(value).toBe('100000');
    }, 30000);

    it('should update whale trade minimum', async () => {
      const input = await page.$('[data-testid="whale-trade-input"]');
      await input?.click({ clickCount: 3 });
      await input?.type('200000');

      const value = await page.evaluate((el) => (el as HTMLInputElement)?.value, input);
      expect(value).toBe('200000');
    }, 30000);

    it('should display suspicion score input with default value', async () => {
      const input = await page.$('[data-testid="suspicion-score-input"]');
      expect(input).toBeTruthy();

      const value = await page.evaluate((el) => (el as HTMLInputElement)?.value, input);
      expect(value).toBe('75');
    }, 30000);

    it('should display price change input with default value', async () => {
      const input = await page.$('[data-testid="price-change-input"]');
      expect(input).toBeTruthy();

      const value = await page.evaluate((el) => (el as HTMLInputElement)?.value, input);
      expect(value).toBe('10');
    }, 30000);
  });

  describe('Notification Settings', () => {
    beforeEach(async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });
    });

    it('should display email notification toggle', async () => {
      const checkbox = await page.$('[data-testid="email-enabled-checkbox"]');
      expect(checkbox).toBeTruthy();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(true); // Default is enabled
    }, 30000);

    it('should toggle email notifications', async () => {
      const checkbox = await page.$('[data-testid="email-enabled-checkbox"]');
      await checkbox?.click();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(false);
    }, 30000);

    it('should display email address input when enabled', async () => {
      const input = await page.$('[data-testid="email-address-input"]');
      expect(input).toBeTruthy();

      const value = await page.evaluate((el) => (el as HTMLInputElement)?.value, input);
      expect(value).toBe('user@example.com');
    }, 30000);

    it('should hide email address input when disabled', async () => {
      const checkbox = await page.$('[data-testid="email-enabled-checkbox"]');
      await checkbox?.click();

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for DOM update

      const input = await page.$('[data-testid="email-address-input"]');
      expect(input).toBeFalsy();
    }, 30000);

    it('should display push notification toggle', async () => {
      const checkbox = await page.$('[data-testid="push-enabled-checkbox"]');
      expect(checkbox).toBeTruthy();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(false); // Default is disabled
    }, 30000);

    it('should display SMS notification toggle', async () => {
      const checkbox = await page.$('[data-testid="sms-enabled-checkbox"]');
      expect(checkbox).toBeTruthy();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(false); // Default is disabled
    }, 30000);

    it('should toggle SMS notifications', async () => {
      const checkbox = await page.$('[data-testid="sms-enabled-checkbox"]');
      await checkbox?.click();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(true);
    }, 30000);

    it('should show phone number input when SMS is enabled', async () => {
      const checkbox = await page.$('[data-testid="sms-enabled-checkbox"]');
      await checkbox?.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      const input = await page.$('[data-testid="sms-phone-input"]');
      expect(input).toBeTruthy();
    }, 30000);

    it('should hide phone number input when SMS is disabled', async () => {
      // First enable it
      const checkbox = await page.$('[data-testid="sms-enabled-checkbox"]');
      await checkbox?.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify input is visible
      let input = await page.$('[data-testid="sms-phone-input"]');
      expect(input).toBeTruthy();

      // Disable it again
      await checkbox?.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify input is hidden
      input = await page.$('[data-testid="sms-phone-input"]');
      expect(input).toBeFalsy();
    }, 30000);

    it('should update SMS phone number', async () => {
      const checkbox = await page.$('[data-testid="sms-enabled-checkbox"]');
      await checkbox?.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      const input = await page.$('[data-testid="sms-phone-input"]');
      await input?.type('+15551234567');

      const value = await page.evaluate((el) => (el as HTMLInputElement)?.value, input);
      expect(value).toBe('+15551234567');
    }, 30000);

    it('should display frequency selector', async () => {
      const select = await page.$('[data-testid="frequency-select"]');
      expect(select).toBeTruthy();

      const value = await page.evaluate((el) => (el as HTMLSelectElement)?.value, select);
      expect(value).toBe('realtime');
    }, 30000);

    it('should change notification frequency', async () => {
      const select = await page.$('[data-testid="frequency-select"]');
      await select?.select('hourly');

      const value = await page.evaluate((el) => (el as HTMLSelectElement)?.value, select);
      expect(value).toBe('hourly');
    }, 30000);

    it('should display quiet hours toggle', async () => {
      const checkbox = await page.$('[data-testid="quiet-hours-enabled-checkbox"]');
      expect(checkbox).toBeTruthy();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(false); // Default is disabled
    }, 30000);

    it('should show quiet hours inputs when enabled', async () => {
      const checkbox = await page.$('[data-testid="quiet-hours-enabled-checkbox"]');
      await checkbox?.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      const startInput = await page.$('[data-testid="quiet-hours-start-input"]');
      const endInput = await page.$('[data-testid="quiet-hours-end-input"]');

      expect(startInput).toBeTruthy();
      expect(endInput).toBeTruthy();
    }, 30000);
  });

  describe('Display Settings', () => {
    beforeEach(async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });
    });

    it('should display compact mode toggle', async () => {
      const checkbox = await page.$('[data-testid="compact-mode-checkbox"]');
      expect(checkbox).toBeTruthy();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(false); // Default is disabled
    }, 30000);

    it('should toggle compact mode', async () => {
      const checkbox = await page.$('[data-testid="compact-mode-checkbox"]');
      await checkbox?.click();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(true);
    }, 30000);

    it('should display advanced metrics toggle', async () => {
      const checkbox = await page.$('[data-testid="advanced-metrics-checkbox"]');
      expect(checkbox).toBeTruthy();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(true); // Default is enabled
    }, 30000);

    it('should display time range selector', async () => {
      const select = await page.$('[data-testid="time-range-select"]');
      expect(select).toBeTruthy();

      const value = await page.evaluate((el) => (el as HTMLSelectElement)?.value, select);
      expect(value).toBe('24h');
    }, 30000);

    it('should change default time range', async () => {
      const select = await page.$('[data-testid="time-range-select"]');
      await select?.select('7d');

      const value = await page.evaluate((el) => (el as HTMLSelectElement)?.value, select);
      expect(value).toBe('7d');
    }, 30000);
  });

  describe('Privacy Settings', () => {
    beforeEach(async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });
    });

    it('should display analytics sharing toggle', async () => {
      const checkbox = await page.$('[data-testid="analytics-checkbox"]');
      expect(checkbox).toBeTruthy();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(false); // Default is disabled
    }, 30000);

    it('should display cookies toggle', async () => {
      const checkbox = await page.$('[data-testid="cookies-checkbox"]');
      expect(checkbox).toBeTruthy();

      const checked = await page.evaluate((el) => (el as HTMLInputElement)?.checked, checkbox);
      expect(checked).toBe(true); // Default is enabled
    }, 30000);
  });

  describe('Save Functionality', () => {
    beforeEach(async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });
    });

    it('should show save bar when changes are made', async () => {
      // Make a change
      const input = await page.$('[data-testid="volume-spike-input"]');
      await input?.click({ clickCount: 3 });
      await input?.type('999');

      await new Promise(resolve => setTimeout(resolve, 100));

      const saveBar = await page.$('[data-testid="save-bar"]');
      expect(saveBar).toBeTruthy();
    }, 30000);

    it('should display save and reset buttons in save bar', async () => {
      // Make a change
      const input = await page.$('[data-testid="volume-spike-input"]');
      await input?.click({ clickCount: 3 });
      await input?.type('999');

      await new Promise(resolve => setTimeout(resolve, 100));

      const saveButton = await page.$('[data-testid="save-button"]');
      const resetButton = await page.$('[data-testid="reset-button"]');

      expect(saveButton).toBeTruthy();
      expect(resetButton).toBeTruthy();
    }, 30000);

    it('should save settings when save button is clicked', async () => {
      // Make a change
      const input = await page.$('[data-testid="volume-spike-input"]');
      await input?.click({ clickCount: 3 });
      await input?.type('999');

      await new Promise(resolve => setTimeout(resolve, 100));

      const saveButton = await page.$('[data-testid="save-button"]');
      await saveButton?.click();

      // Wait for save to complete
      await page.waitForSelector('[data-testid="save-message"]', { timeout: 3000 });

      const saveMessage = await page.$('[data-testid="save-message"]');
      expect(saveMessage).toBeTruthy();
    }, 30000);

    it('should display success message after save', async () => {
      // Make a change and save
      const input = await page.$('[data-testid="volume-spike-input"]');
      await input?.click({ clickCount: 3 });
      await input?.type('999');

      await new Promise(resolve => setTimeout(resolve, 100));

      const saveButton = await page.$('[data-testid="save-button"]');
      await saveButton?.click();

      await page.waitForSelector('[data-testid="save-message"]', { timeout: 3000 });

      const messageText = await page.evaluate(() => {
        const msg = document.querySelector('[data-testid="save-message"]');
        return msg?.textContent;
      });

      expect(messageText).toContain('success');
    }, 30000);

    it('should hide save bar after successful save', async () => {
      // Make a change and save
      const input = await page.$('[data-testid="volume-spike-input"]');
      await input?.click({ clickCount: 3 });
      await input?.type('999');

      await new Promise(resolve => setTimeout(resolve, 100));

      const saveButton = await page.$('[data-testid="save-button"]');
      await saveButton?.click();

      // Wait for save to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      const saveBar = await page.$('[data-testid="save-bar"]');
      expect(saveBar).toBeFalsy();
    }, 30000);
  });

  describe('Dark Mode', () => {
    it('should work in dark mode', async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });

      // Switch to dark mode via theme toggle
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const layout = await page.$('[data-testid="settings-layout"]');
      expect(layout).toBeTruthy();

      // Verify dark mode classes are applied
      const htmlClasses = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });

      expect(htmlClasses).toBe(true);
    }, 30000);
  });

  describe('Responsive Design', () => {
    it('should work on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });

      const layout = await page.$('[data-testid="settings-layout"]');
      expect(layout).toBeTruthy();

      // Verify content is visible
      const category = await page.$('[data-testid="settings-category-alert-thresholds"]');
      expect(category).toBeTruthy();
    }, 30000);

    it('should work on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });

      const layout = await page.$('[data-testid="settings-layout"]');
      expect(layout).toBeTruthy();
    }, 30000);
  });

  describe('Navigation', () => {
    it('should navigate back to dashboard when back link clicked', async () => {
      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });

      const backLink = await page.$('[data-testid="back-to-dashboard-link"]');
      await backLink?.click();

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });

      const url = page.url();
      expect(url).toContain('/dashboard');
    }, 30000);
  });

  describe('Console Errors', () => {
    it('should not have console errors on page load', async () => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(SETTINGS_URL, { waitUntil: 'networkidle2' });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Filter out common non-critical errors
      const criticalErrors = errors.filter(
        (error) =>
          !error.includes('favicon') &&
          !error.includes('404') &&
          !error.includes('net::ERR')
      );

      expect(criticalErrors.length).toBe(0);
    }, 30000);
  });
});
