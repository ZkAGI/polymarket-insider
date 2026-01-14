/**
 * E2E Browser Tests for Dashboard Alerts API
 * Feature: UI-API-002 - Dashboard alerts API endpoint
 *
 * Tests the /api/dashboard/alerts endpoint with real HTTP requests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const ALERTS_API_URL = `${BASE_URL}/api/dashboard/alerts`;

describe('Dashboard Alerts API E2E Tests', () => {
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
      const response = await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);
    });

    it('should return valid JSON response', async () => {
      const response = await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      // Verify the response has the expected structure
      expect(data).toHaveProperty('alerts');
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('filters');
      expect(data).toHaveProperty('generatedAt');
    });

    it('should have correct pagination structure', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination).toHaveProperty('offset');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('hasMore');
    });

    it('should have correct filters structure', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters).toHaveProperty('severity');
      expect(data.filters).toHaveProperty('type');
      expect(data.filters).toHaveProperty('since');
      expect(data.filters).toHaveProperty('read');
    });

    it('should return array for alerts', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(Array.isArray(data.alerts)).toBe(true);
    });

    it('should return numeric values for pagination', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(typeof data.pagination.offset).toBe('number');
      expect(typeof data.pagination.limit).toBe('number');
      expect(typeof data.pagination.total).toBe('number');
      expect(typeof data.pagination.hasMore).toBe('boolean');
    });

    it('should return valid ISO timestamp for generatedAt', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

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
      const response = await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['cache-control']).toContain('public');
      expect(headers?.['cache-control']).toContain('max-age=15');
    });

    it('should include X-Cache header', async () => {
      const response = await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['x-cache']).toBeDefined();
      expect(['HIT', 'MISS']).toContain(headers?.['x-cache']);
    });

    it('should include Content-Type application/json', async () => {
      const response = await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['content-type']).toContain('application/json');
    });
  });

  describe('Pagination Query Parameters', () => {
    it('should use default limit of 20', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(20);
    });

    it('should use default offset of 0', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.offset).toBe(0);
    });

    it('should accept custom limit', async () => {
      await page.goto(`${ALERTS_API_URL}?limit=50`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(50);
    });

    it('should cap limit at 100', async () => {
      await page.goto(`${ALERTS_API_URL}?limit=200`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(100);
    });

    it('should accept custom offset', async () => {
      await page.goto(`${ALERTS_API_URL}?offset=40`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.offset).toBe(40);
    });

    it('should handle invalid limit gracefully', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?limit=invalid`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(20); // default
    });

    it('should handle invalid offset gracefully', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?offset=invalid`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.offset).toBe(0); // default
    });
  });

  describe('Severity Filter', () => {
    it('should accept single severity filter', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?severity=HIGH`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.severity).toEqual(['HIGH']);
    });

    it('should accept multiple severity filters', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?severity=HIGH,CRITICAL`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.severity).toEqual(['HIGH', 'CRITICAL']);
    });

    it('should handle case-insensitive severity', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?severity=high,critical`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.severity).toEqual(['HIGH', 'CRITICAL']);
    });

    it('should ignore invalid severity values', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?severity=INVALID,HIGH`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.severity).toEqual(['HIGH']);
    });

    it('should set severity to null when all values are invalid', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?severity=INVALID,WRONG`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.severity).toBeNull();
    });
  });

  describe('Type Filter', () => {
    it('should accept single type filter', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?type=WHALE_TRADE`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.type).toEqual(['WHALE_TRADE']);
    });

    it('should accept multiple type filters', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?type=WHALE_TRADE,FRESH_WALLET`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.type).toEqual(['WHALE_TRADE', 'FRESH_WALLET']);
    });

    it('should handle case-insensitive type', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?type=whale_trade`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.type).toEqual(['WHALE_TRADE']);
    });

    it('should ignore invalid type values', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?type=INVALID,WHALE_TRADE`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.type).toEqual(['WHALE_TRADE']);
    });
  });

  describe('Since Filter', () => {
    it('should accept valid ISO date', async () => {
      const sinceDate = '2026-01-14T00:00:00.000Z';
      const response = await page.goto(`${ALERTS_API_URL}?since=${encodeURIComponent(sinceDate)}`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.since).toBe(sinceDate);
    });

    it('should handle invalid date gracefully', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?since=invalid-date`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.since).toBeNull();
    });
  });

  describe('Read Filter', () => {
    it('should accept read=true', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?read=true`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.read).toBe(true);
    });

    it('should accept read=false', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?read=false`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.read).toBe(false);
    });

    it('should handle invalid read value gracefully', async () => {
      const response = await page.goto(`${ALERTS_API_URL}?read=invalid`, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.read).toBeNull();
    });
  });

  describe('Combined Filters', () => {
    it('should accept multiple filters together', async () => {
      const url = `${ALERTS_API_URL}?severity=HIGH,CRITICAL&type=WHALE_TRADE&limit=50&offset=10`;
      const response = await page.goto(url, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.severity).toEqual(['HIGH', 'CRITICAL']);
      expect(data.filters.type).toEqual(['WHALE_TRADE']);
      expect(data.pagination.limit).toBe(50);
      expect(data.pagination.offset).toBe(10);
    });
  });

  describe('API Caching Behavior', () => {
    it('should return consistent data within cache TTL', async () => {
      // First request
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      const text1 = await page.evaluate(() => document.body.textContent);
      const data1 = JSON.parse(text1 ?? '');

      // Small delay (less than 15s cache TTL)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second request - should return same generatedAt if cached
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      const text2 = await page.evaluate(() => document.body.textContent);
      const data2 = JSON.parse(text2 ?? '');

      // The generatedAt should be the same if cache was hit
      expect(data1.generatedAt).toBe(data2.generatedAt);
    });

    it('should have cache HIT on subsequent request', async () => {
      // First request - should be MISS
      const response1 = await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      const firstCacheHeader = response1?.headers()['x-cache'];

      // Second request - should be HIT if cache is working
      const response2 = await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
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
    it('should have non-negative values for pagination total', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.total).toBeGreaterThanOrEqual(0);
    });

    it('should have recent generatedAt timestamp', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      const generatedAt = new Date(data.generatedAt);
      const now = new Date();
      const diffMs = now.getTime() - generatedAt.getTime();

      // Should be generated within the last minute (accounting for cache TTL)
      expect(diffMs).toBeLessThan(60 * 1000);
    });

    it('should return alerts with correct structure if present', async () => {
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.alerts.length > 0) {
        const alert = data.alerts[0];
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('title');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('tags');
        expect(alert).toHaveProperty('read');
        expect(alert).toHaveProperty('acknowledged');
        expect(alert).toHaveProperty('createdAt');
        expect(alert).toHaveProperty('market');
        expect(alert).toHaveProperty('wallet');
      }
    });
  });

  describe('API Performance', () => {
    it('should respond within 2 seconds', async () => {
      const startTime = Date.now();
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(2000);
    });

    it('should respond faster on cache hit', async () => {
      // First request (may be MISS)
      const start1 = Date.now();
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
      const time1 = Date.now() - start1;

      // Second request (should be HIT)
      const start2 = Date.now();
      await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
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
        const response = await fetch('/api/dashboard/alerts');
        return response.json();
      });

      // Verify the API data is valid
      expect(apiData).toHaveProperty('alerts');
      expect(apiData).toHaveProperty('pagination');
      expect(apiData).toHaveProperty('filters');
      expect(apiData).toHaveProperty('generatedAt');
    });
  });

  describe('API Error Scenarios', () => {
    it('should handle requests gracefully', async () => {
      // Make multiple rapid requests
      const promises = Array.from({ length: 5 }, async () => {
        const response = await page.goto(ALERTS_API_URL, { waitUntil: 'networkidle2' });
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
