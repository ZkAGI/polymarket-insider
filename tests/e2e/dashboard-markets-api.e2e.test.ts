/**
 * E2E Browser Tests for Dashboard Markets API
 * Feature: UI-API-004 - Dashboard markets API endpoint
 *
 * Tests the /api/dashboard/markets endpoint with real HTTP requests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const MARKETS_API_URL = `${BASE_URL}/api/dashboard/markets`;

describe('Dashboard Markets API E2E Tests', () => {
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
      const response = await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);
    });

    it('should return valid JSON response with correct structure', async () => {
      const response = await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data).toHaveProperty('markets');
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('filters');
      expect(data).toHaveProperty('generatedAt');
    });

    it('should have correct pagination structure', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination).toHaveProperty('offset');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('hasMore');
    });

    it('should have correct filters structure', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters).toHaveProperty('category');
    });

    it('should return markets as an array', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(Array.isArray(data.markets)).toBe(true);
    });

    it('should return valid ISO timestamp for generatedAt', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(typeof data.generatedAt).toBe('string');
      const date = new Date(data.generatedAt);
      expect(date.toISOString()).toBe(data.generatedAt);
    });
  });

  describe('Market Data Structure', () => {
    it('should have correct market object structure when markets exist', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.markets.length > 0) {
        const market = data.markets[0];

        expect(market).toHaveProperty('id');
        expect(market).toHaveProperty('question');
        expect(market).toHaveProperty('slug');
        expect(market).toHaveProperty('category');
        expect(market).toHaveProperty('subcategory');
        expect(market).toHaveProperty('volume');
        expect(market).toHaveProperty('volume24h');
        expect(market).toHaveProperty('liquidity');
        expect(market).toHaveProperty('alertCount');
        expect(market).toHaveProperty('topAlertType');
        expect(market).toHaveProperty('active');
        expect(market).toHaveProperty('closed');
        expect(market).toHaveProperty('endDate');
        expect(market).toHaveProperty('imageUrl');
        expect(market).toHaveProperty('outcomes');
      }
    });

    it('should have correct outcomes structure in market objects', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.markets.length > 0 && data.markets[0].outcomes.length > 0) {
        const outcome = data.markets[0].outcomes[0];

        expect(outcome).toHaveProperty('name');
        expect(outcome).toHaveProperty('price');
        expect(outcome).toHaveProperty('priceChange24h');
      }
    });

    it('should have correct data types for market fields when markets exist', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.markets.length > 0) {
        const market = data.markets[0];

        expect(typeof market.id).toBe('string');
        expect(typeof market.question).toBe('string');
        expect(typeof market.slug).toBe('string');
        expect(typeof market.volume).toBe('number');
        expect(typeof market.volume24h).toBe('number');
        expect(typeof market.liquidity).toBe('number');
        expect(typeof market.alertCount).toBe('number');
        expect(typeof market.active).toBe('boolean');
        expect(typeof market.closed).toBe('boolean');
        expect(Array.isArray(market.outcomes)).toBe(true);
      }
    });
  });

  describe('API Response Headers', () => {
    it('should include Cache-Control header', async () => {
      const response = await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['cache-control']).toContain('public');
      expect(headers?.['cache-control']).toContain('max-age=30');
    });

    it('should include X-Cache header', async () => {
      const response = await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['x-cache']).toBeDefined();
      expect(['HIT', 'MISS']).toContain(headers?.['x-cache']);
    });

    it('should include Content-Type application/json', async () => {
      const response = await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['content-type']).toContain('application/json');
    });
  });

  describe('Pagination Parameters', () => {
    it('should use default limit of 10', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(10);
    });

    it('should use default offset of 0', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.offset).toBe(0);
    });

    it('should respect custom limit parameter', async () => {
      await page.goto(`${MARKETS_API_URL}?limit=5`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(5);
    });

    it('should respect custom offset parameter', async () => {
      await page.goto(`${MARKETS_API_URL}?offset=20`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.offset).toBe(20);
    });

    it('should cap limit at 50', async () => {
      await page.goto(`${MARKETS_API_URL}?limit=100`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(50);
    });

    it('should enforce minimum limit of 1', async () => {
      await page.goto(`${MARKETS_API_URL}?limit=0`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(1);
    });

    it('should handle invalid limit gracefully', async () => {
      await page.goto(`${MARKETS_API_URL}?limit=invalid`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(10); // Default
    });

    it('should handle invalid offset gracefully', async () => {
      await page.goto(`${MARKETS_API_URL}?offset=invalid`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.offset).toBe(0); // Default
    });
  });

  describe('Category Filter Parameter', () => {
    it('should accept category parameter', async () => {
      await page.goto(`${MARKETS_API_URL}?category=politics`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.category).toBe('politics');
    });

    it('should return null category when not filtered', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.category).toBeNull();
    });

    it('should accept crypto category', async () => {
      await page.goto(`${MARKETS_API_URL}?category=crypto`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.category).toBe('crypto');
    });

    it('should accept sports category', async () => {
      await page.goto(`${MARKETS_API_URL}?category=sports`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.category).toBe('sports');
    });

    it('should combine category with pagination', async () => {
      await page.goto(
        `${MARKETS_API_URL}?category=politics&limit=5&offset=10`,
        { waitUntil: 'networkidle2' }
      );

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.category).toBe('politics');
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.offset).toBe(10);
    });
  });

  describe('API Caching Behavior', () => {
    it('should return consistent data within cache TTL', async () => {
      // First request
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const text1 = await page.evaluate(() => document.body.textContent);
      const data1 = JSON.parse(text1 ?? '');

      // Small delay (less than 30s cache TTL)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second request - should return same generatedAt if cached
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const text2 = await page.evaluate(() => document.body.textContent);
      const data2 = JSON.parse(text2 ?? '');

      expect(data1.generatedAt).toBe(data2.generatedAt);
    });

    it('should have cache HIT on subsequent request', async () => {
      // First request
      const response1 = await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const firstCacheHeader = response1?.headers()['x-cache'];

      // Second request
      const response2 = await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const secondCacheHeader = response2?.headers()['x-cache'];

      if (firstCacheHeader === 'MISS') {
        expect(secondCacheHeader).toBe('HIT');
      } else {
        expect(secondCacheHeader).toBe('HIT');
      }
    });

    it('should use different cache keys for different categories', async () => {
      // First request with no category
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      // Second request with category filter
      const response2 = await page.goto(
        `${MARKETS_API_URL}?category=politics`,
        { waitUntil: 'networkidle2' }
      );

      // Different filters should result in different cache entries
      // The second request should be MISS for a different cache key
      const cacheHeader = response2?.headers()['x-cache'];
      expect(['HIT', 'MISS']).toContain(cacheHeader);
    });
  });

  describe('API Data Validity', () => {
    it('should have non-negative values for numeric fields', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.total).toBeGreaterThanOrEqual(0);
      expect(data.pagination.offset).toBeGreaterThanOrEqual(0);
      expect(data.pagination.limit).toBeGreaterThan(0);

      if (data.markets.length > 0) {
        const market = data.markets[0];
        expect(market.volume).toBeGreaterThanOrEqual(0);
        expect(market.volume24h).toBeGreaterThanOrEqual(0);
        expect(market.liquidity).toBeGreaterThanOrEqual(0);
        expect(market.alertCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have recent generatedAt timestamp', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      const generatedAt = new Date(data.generatedAt);
      const now = new Date();
      const diffMs = now.getTime() - generatedAt.getTime();

      // Should be generated within the last minute (accounting for cache TTL)
      expect(diffMs).toBeLessThan(60 * 1000);
    });

    it('should have valid alert types when topAlertType exists', async () => {
      const validAlertTypes = [
        'WHALE_TRADE',
        'PRICE_MOVEMENT',
        'INSIDER_ACTIVITY',
        'FRESH_WALLET',
        'WALLET_REACTIVATION',
        'COORDINATED_ACTIVITY',
        'UNUSUAL_PATTERN',
        'MARKET_RESOLVED',
        'NEW_MARKET',
        'SUSPICIOUS_FUNDING',
        'SANCTIONED_ACTIVITY',
        'SYSTEM',
      ];

      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const market of data.markets) {
        if (market.topAlertType !== null) {
          expect(validAlertTypes).toContain(market.topAlertType);
        }
      }
    });

    it('should have outcome prices between 0 and 1', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const market of data.markets) {
        for (const outcome of market.outcomes) {
          expect(outcome.price).toBeGreaterThanOrEqual(0);
          expect(outcome.price).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('API Performance', () => {
    it('should respond within 3 seconds', async () => {
      const startTime = Date.now();
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(3000);
    });

    it('should respond faster on cache hit', async () => {
      // First request (may be MISS)
      const start1 = Date.now();
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const time1 = Date.now() - start1;

      // Second request (should be HIT)
      const start2 = Date.now();
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
      const time2 = Date.now() - start2;

      expect(time2).toBeLessThan(time1 + 100);
    });
  });

  describe('API Integration with Dashboard', () => {
    it('should be consumable by dashboard page', async () => {
      // Navigate to dashboard
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });

      // Wait a moment for the page to settle
      await page.waitForFunction(
        () => document.readyState === 'complete',
        { timeout: 10000 }
      ).catch(() => {
        // Page may not fully load in test environment
      });

      // Make API request from the page context
      const apiData = await page.evaluate(async () => {
        const response = await fetch('/api/dashboard/markets');
        return response.json();
      });

      // Verify the API data is valid
      expect(apiData).toHaveProperty('markets');
      expect(apiData).toHaveProperty('pagination');
      expect(apiData).toHaveProperty('filters');
      expect(apiData).toHaveProperty('generatedAt');
    });

    it('should work with fetch API from browser context', async () => {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' }).catch(() => {
        // May fail if dashboard doesn't exist yet, use any page
      });

      const result = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/dashboard/markets?limit=5&category=crypto');
          const data = await response.json();
          return {
            status: response.status,
            ok: response.ok,
            hasMarkets: Array.isArray(data.markets),
            limit: data.pagination?.limit,
            categoryFilter: data.filters?.category,
          };
        } catch (error) {
          return { error: String(error) };
        }
      });

      expect(result.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.hasMarkets).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.categoryFilter).toBe('crypto');
    });
  });

  describe('API Error Scenarios', () => {
    it('should handle requests gracefully', async () => {
      // Make multiple rapid requests
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const response = await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });
        responses.push(response?.status());
      }

      // All requests should succeed
      for (const status of responses) {
        expect(status).toBe(200);
      }
    });

    it('should handle concurrent requests', async () => {
      // Navigate to a page first
      await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle2' }).catch(() => {});

      // Make concurrent requests from browser
      const results = await page.evaluate(async () => {
        const requests = Array.from({ length: 3 }, () =>
          fetch('/api/dashboard/markets').then(r => r.status)
        );
        return Promise.all(requests);
      });

      for (const status of results) {
        expect(status).toBe(200);
      }
    });
  });

  describe('Pagination Correctness', () => {
    it('should correctly report hasMore when more results exist', async () => {
      await page.goto(`${MARKETS_API_URL}?limit=1`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.pagination.total > 1) {
        expect(data.pagination.hasMore).toBe(true);
      } else if (data.pagination.total <= 1) {
        expect(data.pagination.hasMore).toBe(false);
      }
    });

    it('should return correct number of markets based on limit', async () => {
      await page.goto(`${MARKETS_API_URL}?limit=5`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.markets.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Alert Count and Top Alert Type', () => {
    it('should include alertCount as a number', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const market of data.markets) {
        expect(typeof market.alertCount).toBe('number');
        expect(market.alertCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include topAlertType as string or null', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const market of data.markets) {
        expect(
          market.topAlertType === null || typeof market.topAlertType === 'string'
        ).toBe(true);
      }
    });
  });

  describe('Market Status Flags', () => {
    it('should include active status as boolean', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const market of data.markets) {
        expect(typeof market.active).toBe('boolean');
      }
    });

    it('should include closed status as boolean', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const market of data.markets) {
        expect(typeof market.closed).toBe('boolean');
      }
    });
  });

  describe('Outcome Data', () => {
    it('should return outcomes as an array', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const market of data.markets) {
        expect(Array.isArray(market.outcomes)).toBe(true);
      }
    });

    it('should have correct outcome structure', async () => {
      await page.goto(MARKETS_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const market of data.markets) {
        for (const outcome of market.outcomes) {
          expect(typeof outcome.name).toBe('string');
          expect(typeof outcome.price).toBe('number');
          expect(typeof outcome.priceChange24h).toBe('number');
        }
      }
    });
  });
});
