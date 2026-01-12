/**
 * E2E Browser Tests for ThemeToggle
 * Feature: UI-DASH-010 - Dashboard theme toggle
 *
 * Tests use Puppeteer to verify theme toggle functionality in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/dashboard`;
const STORAGE_KEY = 'polymarket-tracker-theme';

describe('ThemeToggle E2E Tests', () => {
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

  describe('Theme Toggle Loading', () => {
    it('should load the dashboard with theme toggle', async () => {
      // Clear localStorage for this test
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.evaluate(() => localStorage.clear());
      const response = await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      );

      const themeToggle = await page.$('[data-testid="dashboard-theme-toggle"]');
      expect(themeToggle).not.toBeNull();
    });

    it('should display theme toggle button', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );

      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      expect(toggleButton).not.toBeNull();
    });

    it('should show theme icon in toggle button', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-button"]') !== null,
        { timeout: 10000 }
      );

      const buttonContent = await page.$eval(
        '[data-testid="dashboard-theme-toggle-button"]',
        (el) => el.textContent
      );
      // Should contain sun or moon emoji
      expect(buttonContent).toMatch(/[☀️🌙]/);
    });
  });

  describe('Theme Toggle Dropdown', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should open dropdown when clicking toggle button', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      expect(toggleButton).not.toBeNull();

      await toggleButton!.click();

      // Wait for dropdown to appear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="dashboard-theme-toggle-dropdown"]');
      expect(dropdown).not.toBeNull();
    });

    it('should show all three theme options in dropdown', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const lightOption = await page.$('[data-testid="dashboard-theme-toggle-option-light"]');
      const darkOption = await page.$('[data-testid="dashboard-theme-toggle-option-dark"]');
      const systemOption = await page.$('[data-testid="dashboard-theme-toggle-option-system"]');

      expect(lightOption).not.toBeNull();
      expect(darkOption).not.toBeNull();
      expect(systemOption).not.toBeNull();
    });

    it('should show Light label in light option', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-light"]') !== null,
        { timeout: 5000 }
      );

      const lightText = await page.$eval(
        '[data-testid="dashboard-theme-toggle-option-light"]',
        (el) => el.textContent
      );
      expect(lightText).toContain('Light');
    });

    it('should show Dark label in dark option', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-dark"]') !== null,
        { timeout: 5000 }
      );

      const darkText = await page.$eval(
        '[data-testid="dashboard-theme-toggle-option-dark"]',
        (el) => el.textContent
      );
      expect(darkText).toContain('Dark');
    });

    it('should show System label in system option', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-system"]') !== null,
        { timeout: 5000 }
      );

      const systemText = await page.$eval(
        '[data-testid="dashboard-theme-toggle-option-system"]',
        (el) => el.textContent
      );
      expect(systemText).toContain('System');
    });

    it('should close dropdown when clicking outside', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Click outside the dropdown
      await page.click('body');

      // Wait for dropdown to disappear
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="dashboard-theme-toggle-dropdown"]');
      expect(dropdown).toBeNull();
    });

    it('should close dropdown when pressing Escape', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') !== null,
        { timeout: 5000 }
      );

      await page.keyboard.press('Escape');

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="dashboard-theme-toggle-dropdown"]');
      expect(dropdown).toBeNull();
    });
  });

  describe('Theme Selection', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should switch to light theme when selecting Light', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-light"]') !== null,
        { timeout: 5000 }
      );

      const lightOption = await page.$('[data-testid="dashboard-theme-toggle-option-light"]');
      await lightOption!.click();

      // Wait for theme to apply
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check that html element has light class
      const hasLightClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('light');
      });
      expect(hasLightClass).toBe(true);
    });

    it('should switch to dark theme when selecting Dark', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-dark"]') !== null,
        { timeout: 5000 }
      );

      const darkOption = await page.$('[data-testid="dashboard-theme-toggle-option-dark"]');
      await darkOption!.click();

      // Wait for theme to apply
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check that html element has dark class
      const hasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      expect(hasDarkClass).toBe(true);
    });

    it('should close dropdown after selecting a theme', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-dark"]') !== null,
        { timeout: 5000 }
      );

      const darkOption = await page.$('[data-testid="dashboard-theme-toggle-option-dark"]');
      await darkOption!.click();

      // Wait for dropdown to close
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="dashboard-theme-toggle-dropdown"]');
      expect(dropdown).toBeNull();
    });
  });

  describe('Theme Persistence', () => {
    it('should persist dark theme to localStorage', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );

      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-dark"]') !== null,
        { timeout: 5000 }
      );

      const darkOption = await page.$('[data-testid="dashboard-theme-toggle-option-dark"]');
      await darkOption!.click();

      // Wait for storage to be set
      await new Promise((resolve) => setTimeout(resolve, 500));

      const storedTheme = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, STORAGE_KEY);

      expect(storedTheme).toBe('dark');
    });

    it('should persist light theme to localStorage', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );

      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-light"]') !== null,
        { timeout: 5000 }
      );

      const lightOption = await page.$('[data-testid="dashboard-theme-toggle-option-light"]');
      await lightOption!.click();

      // Wait for storage to be set
      await new Promise((resolve) => setTimeout(resolve, 500));

      const storedTheme = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, STORAGE_KEY);

      expect(storedTheme).toBe('light');
    });

    it('should load persisted dark theme on page refresh', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );

      // Set dark theme
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-dark"]') !== null,
        { timeout: 5000 }
      );

      const darkOption = await page.$('[data-testid="dashboard-theme-toggle-option-dark"]');
      await darkOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh the page
      await page.reload({ waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );

      // Check that dark class is still applied
      const hasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      expect(hasDarkClass).toBe(true);
    });

    it('should load persisted light theme on page refresh', async () => {
      // Emulate light system preference to ensure consistent behavior
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'light' },
      ]);

      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );

      // Set light theme explicitly
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-light"]') !== null,
        { timeout: 5000 }
      );

      const lightOption = await page.$('[data-testid="dashboard-theme-toggle-option-light"]');
      await lightOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify localStorage has light theme before reload
      const storedBefore = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, STORAGE_KEY);
      expect(storedBefore).toBe('light');

      // Refresh the page (keep media emulation)
      await page.reload({ waitUntil: 'networkidle2' });

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );

      // Verify localStorage still has light theme after reload
      const storedAfter = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, STORAGE_KEY);
      expect(storedAfter).toBe('light');

      // The theme should be applied based on the persisted preference
      // Check that button shows sun icon (light theme)
      const buttonContent = await page.$eval(
        '[data-testid="dashboard-theme-toggle-button"]',
        (el) => el.textContent
      );
      expect(buttonContent).toContain('☀️');
    });
  });

  describe('Visual Theme Changes', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should apply dark background color in dark mode', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-dark"]') !== null,
        { timeout: 5000 }
      );

      const darkOption = await page.$('[data-testid="dashboard-theme-toggle-option-dark"]');
      await darkOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check background color of dashboard layout
      const bgColor = await page.evaluate(() => {
        const element = document.querySelector('[data-testid="dashboard-layout"]');
        if (!element) return null;
        return window.getComputedStyle(element).backgroundColor;
      });

      // Dark mode should have a dark background (rgb values low)
      expect(bgColor).not.toBeNull();
      // RGB values should indicate a dark color
      const match = bgColor?.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const [, r, g, b] = match.map(Number);
        // For dark mode, RGB values should be relatively low (< 100)
        expect(r).toBeLessThan(100);
        expect(g).toBeLessThan(100);
        expect(b).toBeLessThan(100);
      }
    });

    it('should apply light background color in light mode', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-light"]') !== null,
        { timeout: 5000 }
      );

      const lightOption = await page.$('[data-testid="dashboard-theme-toggle-option-light"]');
      await lightOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check background color of dashboard layout
      const bgColor = await page.evaluate(() => {
        const element = document.querySelector('[data-testid="dashboard-layout"]');
        if (!element) return null;
        return window.getComputedStyle(element).backgroundColor;
      });

      expect(bgColor).not.toBeNull();
      // RGB values should indicate a light color
      const match = bgColor?.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const [, r, g, b] = match.map(Number);
        // For light mode, RGB values should be relatively high (> 200)
        expect(r).toBeGreaterThan(200);
        expect(g).toBeGreaterThan(200);
        expect(b).toBeGreaterThan(200);
      }
    });

    it('should update icon when switching to dark mode', async () => {
      // First set to light mode
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-light"]') !== null,
        { timeout: 5000 }
      );

      const lightOption = await page.$('[data-testid="dashboard-theme-toggle-option-light"]');
      await lightOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Now switch to dark
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-dark"]') !== null,
        { timeout: 5000 }
      );

      const darkOption = await page.$('[data-testid="dashboard-theme-toggle-option-dark"]');
      await darkOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check that moon icon is shown
      const buttonContent = await page.$eval(
        '[data-testid="dashboard-theme-toggle-button"]',
        (el) => el.textContent
      );
      expect(buttonContent).toContain('🌙');
    });

    it('should update icon when switching to light mode', async () => {
      // First set to dark mode
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-dark"]') !== null,
        { timeout: 5000 }
      );

      const darkOption = await page.$('[data-testid="dashboard-theme-toggle-option-dark"]');
      await darkOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Now switch to light
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-light"]') !== null,
        { timeout: 5000 }
      );

      const lightOption = await page.$('[data-testid="dashboard-theme-toggle-option-light"]');
      await lightOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check that sun icon is shown
      const buttonContent = await page.$eval(
        '[data-testid="dashboard-theme-toggle-button"]',
        (el) => el.textContent
      );
      expect(buttonContent).toContain('☀️');
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should open dropdown with Enter key', async () => {
      // Focus on the toggle button
      await page.focus('[data-testid="dashboard-theme-toggle-button"]');
      await page.keyboard.press('Enter');

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="dashboard-theme-toggle-dropdown"]');
      expect(dropdown).not.toBeNull();
    });

    it('should open dropdown with Space key', async () => {
      // Focus on the toggle button
      await page.focus('[data-testid="dashboard-theme-toggle-button"]');
      await page.keyboard.press('Space');

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="dashboard-theme-toggle-dropdown"]');
      expect(dropdown).not.toBeNull();
    });

    it('should close dropdown with Escape key', async () => {
      // Open dropdown
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Press Escape
      await page.keyboard.press('Escape');

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') === null,
        { timeout: 5000 }
      );

      const dropdown = await page.$('[data-testid="dashboard-theme-toggle-dropdown"]');
      expect(dropdown).toBeNull();
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should have aria-label on toggle button', async () => {
      const ariaLabel = await page.$eval(
        '[data-testid="dashboard-theme-toggle-button"]',
        (el) => el.getAttribute('aria-label')
      );
      expect(ariaLabel).not.toBeNull();
      expect(ariaLabel).toContain('Theme');
    });

    it('should have aria-expanded attribute on toggle button', async () => {
      const ariaExpanded = await page.$eval(
        '[data-testid="dashboard-theme-toggle-button"]',
        (el) => el.getAttribute('aria-expanded')
      );
      expect(ariaExpanded).not.toBeNull();
    });

    it('should update aria-expanded when dropdown opens', async () => {
      // Initial state
      let ariaExpanded = await page.$eval(
        '[data-testid="dashboard-theme-toggle-button"]',
        (el) => el.getAttribute('aria-expanded')
      );
      expect(ariaExpanded).toBe('false');

      // Open dropdown
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') !== null,
        { timeout: 5000 }
      );

      // Check aria-expanded is now true
      ariaExpanded = await page.$eval(
        '[data-testid="dashboard-theme-toggle-button"]',
        (el) => el.getAttribute('aria-expanded')
      );
      expect(ariaExpanded).toBe('true');
    });

    it('should have aria-haspopup on toggle button', async () => {
      const ariaHaspopup = await page.$eval(
        '[data-testid="dashboard-theme-toggle-button"]',
        (el) => el.getAttribute('aria-haspopup')
      );
      expect(ariaHaspopup).toBe('listbox');
    });

    it('should have role=listbox on dropdown', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-dropdown"]') !== null,
        { timeout: 5000 }
      );

      const role = await page.$eval(
        '[data-testid="dashboard-theme-toggle-dropdown"]',
        (el) => el.getAttribute('role')
      );
      expect(role).toBe('listbox');
    });

    it('should have role=option on dropdown items', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-light"]') !== null,
        { timeout: 5000 }
      );

      const role = await page.$eval(
        '[data-testid="dashboard-theme-toggle-option-light"]',
        (el) => el.getAttribute('role')
      );
      expect(role).toBe('option');
    });
  });

  describe('System Theme', () => {
    beforeEach(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle"]') !== null,
        { timeout: 10000 }
      );
    });

    it('should allow selecting System theme', async () => {
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-system"]') !== null,
        { timeout: 5000 }
      );

      const systemOption = await page.$('[data-testid="dashboard-theme-toggle-option-system"]');
      await systemOption!.click();

      // Wait for storage to be set
      await new Promise((resolve) => setTimeout(resolve, 500));

      const storedTheme = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, STORAGE_KEY);

      expect(storedTheme).toBe('system');
    });

    it('should apply system preference for dark mode', async () => {
      // Emulate dark system preference
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'dark' },
      ]);

      // Select system theme
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-system"]') !== null,
        { timeout: 5000 }
      );

      const systemOption = await page.$('[data-testid="dashboard-theme-toggle-option-system"]');
      await systemOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should apply dark class based on system preference
      const hasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      expect(hasDarkClass).toBe(true);
    });

    it('should apply system preference for light mode', async () => {
      // Emulate light system preference
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'light' },
      ]);

      // Select system theme
      const toggleButton = await page.$('[data-testid="dashboard-theme-toggle-button"]');
      await toggleButton!.click();

      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-theme-toggle-option-system"]') !== null,
        { timeout: 5000 }
      );

      const systemOption = await page.$('[data-testid="dashboard-theme-toggle-option-system"]');
      await systemOption!.click();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should apply light class based on system preference
      const hasLightClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('light');
      });
      expect(hasLightClass).toBe(true);
    });
  });
});
