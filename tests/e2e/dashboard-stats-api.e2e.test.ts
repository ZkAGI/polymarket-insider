/**
 * E2E Browser Tests for Dashboard Stats API
 * Feature: UI-API-001 - Dashboard stats API endpoint
 *
 * Tests the /api/dashboard/stats endpoint with real HTTP requests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const STATS_API_URL = `${BASE_URL}/api/dashboard/stats`;

describe('Dashboard Stats API E2E Tests', () => {
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
  });

  afterEach(async () => {
    await page.close();
  });

  describe('API Response Structure', () => {
    it('should return 200 status code', async () => {
      const response = await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);
    });

    it('should return valid JSON response', async () => {
      const response = await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      // Verify the response has the expected structure
      expect(data).toHaveProperty('alerts');
      expect(data).toHaveProperty('criticalAlerts');
      expect(data).toHaveProperty('suspiciousWallets');
      expect(data).toHaveProperty('hotMarkets');
      expect(data).toHaveProperty('volume24h');
      expect(data).toHaveProperty('whaleTrades');
      expect(data).toHaveProperty('trends');
      expect(data).toHaveProperty('generatedAt');
    });

    it('should have correct trends structure', async () => {
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.trends).toHaveProperty('alerts');
      expect(data.trends).toHaveProperty('criticalAlerts');
      expect(data.trends).toHaveProperty('suspiciousWallets');
      expect(data.trends).toHaveProperty('hotMarkets');
      expect(data.trends).toHaveProperty('volume24h');
      expect(data.trends).toHaveProperty('whaleTrades');
    });

    it('should return numeric values for all stats', async () => {
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(typeof data.alerts).toBe('number');
      expect(typeof data.criticalAlerts).toBe('number');
      expect(typeof data.suspiciousWallets).toBe('number');
      expect(typeof data.hotMarkets).toBe('number');
      expect(typeof data.volume24h).toBe('number');
      expect(typeof data.whaleTrades).toBe('number');
    });

    it('should return numeric values for all trends', async () => {
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(typeof data.trends.alerts).toBe('number');
      expect(typeof data.trends.criticalAlerts).toBe('number');
      expect(typeof data.trends.suspiciousWallets).toBe('number');
      expect(typeof data.trends.hotMarkets).toBe('number');
      expect(typeof data.trends.volume24h).toBe('number');
      expect(typeof data.trends.whaleTrades).toBe('number');
    });

    it('should return valid ISO timestamp for generatedAt', async () => {
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(typeof data.generatedAt).toBe('string');
      // Verify it's a valid ISO date string
      const date = new Date(data.generatedAt);
      expect(date.toISOString()).toBe(data.generatedAt);
    });
  });

  describe('API Response Headers', () => {
    it('should include Cache-Control header', async () => {
      const response = await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['cache-control']).toContain('public');
      expect(headers?.['cache-control']).toContain('max-age=30');
    });

    it('should include X-Cache header', async () => {
      const response = await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['x-cache']).toBeDefined();
      expect(['HIT', 'MISS', 'STALE']).toContain(headers?.['x-cache']);
    });

    it('should include Content-Type application/json', async () => {
      const response = await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['content-type']).toContain('application/json');
    });
  });

  describe('API Caching Behavior', () => {
    it('should return consistent data within cache TTL', async () => {
      // First request
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const text1 = await page.evaluate(() => document.body.textContent);
      const data1 = JSON.parse(text1 ?? '');

      // Small delay (less than 30s cache TTL)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second request - should return same generatedAt if cached
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const text2 = await page.evaluate(() => document.body.textContent);
      const data2 = JSON.parse(text2 ?? '');

      // The generatedAt should be the same if cache was hit
      // Note: This may differ if cache was already expired
      expect(data1.generatedAt).toBe(data2.generatedAt);
    });

    it('should have cache HIT on subsequent request', async () => {
      // First request - should be MISS
      const response1 = await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const firstCacheHeader = response1?.headers()['x-cache'];

      // Second request - should be HIT if cache is working
      const response2 = await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const secondCacheHeader = response2?.headers()['x-cache'];

      // After first request, subsequent requests should hit cache
      if (firstCacheHeader === 'MISS') {
        expect(secondCacheHeader).toBe('HIT');
      } else {
        // If first was HIT (from previous tests), second should also be HIT
        expect(secondCacheHeader).toBe('HIT');
      }
    });
  });

  describe('API Data Validity', () => {
    it('should have non-negative values for counts', async () => {
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.alerts).toBeGreaterThanOrEqual(0);
      expect(data.criticalAlerts).toBeGreaterThanOrEqual(0);
      expect(data.suspiciousWallets).toBeGreaterThanOrEqual(0);
      expect(data.hotMarkets).toBeGreaterThanOrEqual(0);
      expect(data.volume24h).toBeGreaterThanOrEqual(0);
      expect(data.whaleTrades).toBeGreaterThanOrEqual(0);
    });

    it('should have criticalAlerts less than or equal to alerts', async () => {
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.criticalAlerts).toBeLessThanOrEqual(data.alerts);
    });

    it('should have reasonable trend percentages', async () => {
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      // Trends should be finite numbers
      expect(Number.isFinite(data.trends.alerts)).toBe(true);
      expect(Number.isFinite(data.trends.criticalAlerts)).toBe(true);
      expect(Number.isFinite(data.trends.suspiciousWallets)).toBe(true);
      expect(Number.isFinite(data.trends.hotMarkets)).toBe(true);
      expect(Number.isFinite(data.trends.volume24h)).toBe(true);
      expect(Number.isFinite(data.trends.whaleTrades)).toBe(true);
    });

    it('should have recent generatedAt timestamp', async () => {
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      const generatedAt = new Date(data.generatedAt);
      const now = new Date();
      const diffMs = now.getTime() - generatedAt.getTime();

      // Should be generated within the last minute (accounting for cache TTL)
      expect(diffMs).toBeLessThan(60 * 1000);
    });
  });

  describe('API Performance', () => {
    it('should respond within 2 seconds', async () => {
      const startTime = Date.now();
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(2000);
    });

    it('should respond faster on cache hit', async () => {
      // First request (may be MISS)
      const start1 = Date.now();
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const time1 = Date.now() - start1;

      // Second request (should be HIT)
      const start2 = Date.now();
      await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
      const time2 = Date.now() - start2;

      // Cache hit should be faster or similar
      // Allow some variance for network overhead
      expect(time2).toBeLessThan(time1 + 100);
    });
  });

  describe('API Integration with Dashboard', () => {
    it('should be consumable by dashboard page', async () => {
      // Navigate to dashboard
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });

      // Wait for the page to load
      await page.waitForFunction(
        () => document.querySelector('[data-testid="dashboard-layout"]') !== null,
        { timeout: 10000 }
      ).catch(() => {
        // Dashboard may not have this testid yet, that's okay for API test
      });

      // Make API request from the page context
      const apiData = await page.evaluate(async () => {
        const response = await fetch('/api/dashboard/stats');
        return response.json();
      });

      // Verify the API data is valid
      expect(apiData).toHaveProperty('alerts');
      expect(apiData).toHaveProperty('trends');
      expect(apiData).toHaveProperty('generatedAt');
    });
  });

  describe('API Error Scenarios', () => {
    it('should handle requests gracefully', async () => {
      // Make multiple rapid requests
      const promises = Array.from({ length: 5 }, async () => {
        const response = await page.goto(STATS_API_URL, { waitUntil: 'networkidle2' });
        return response?.status();
      });

      const statuses = await Promise.all(promises);

      // All requests should succeed (200) or be cached
      for (const status of statuses) {
        expect(status).toBe(200);
      }
    });
  });
});
