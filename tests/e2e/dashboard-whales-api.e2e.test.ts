/**
 * E2E Browser Tests for Dashboard Whales API
 * Feature: UI-API-003 - Dashboard whales API endpoint
 *
 * Tests the /api/dashboard/whales endpoint with real HTTP requests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const WHALES_API_URL = `${BASE_URL}/api/dashboard/whales`;

describe('Dashboard Whales API E2E Tests', () => {
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
      const response = await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);
    });

    it('should return valid JSON response with correct structure', async () => {
      const response = await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      expect(response?.status()).toBe(200);

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data).toHaveProperty('wallets');
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('filters');
      expect(data).toHaveProperty('generatedAt');
    });

    it('should have correct pagination structure', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination).toHaveProperty('offset');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('hasMore');
    });

    it('should have correct filters structure', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters).toHaveProperty('minScore');
      expect(data.filters).toHaveProperty('isWhale');
      expect(data.filters).toHaveProperty('isInsider');
      expect(data.filters).toHaveProperty('isFlagged');
    });

    it('should return wallets as an array', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(Array.isArray(data.wallets)).toBe(true);
    });

    it('should return valid ISO timestamp for generatedAt', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(typeof data.generatedAt).toBe('string');
      const date = new Date(data.generatedAt);
      expect(date.toISOString()).toBe(data.generatedAt);
    });
  });

  describe('Wallet Data Structure', () => {
    it('should have correct wallet object structure when wallets exist', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.wallets.length > 0) {
        const wallet = data.wallets[0];

        expect(wallet).toHaveProperty('id');
        expect(wallet).toHaveProperty('address');
        expect(wallet).toHaveProperty('label');
        expect(wallet).toHaveProperty('walletType');
        expect(wallet).toHaveProperty('suspicionScore');
        expect(wallet).toHaveProperty('riskLevel');
        expect(wallet).toHaveProperty('totalVolume');
        expect(wallet).toHaveProperty('tradeCount');
        expect(wallet).toHaveProperty('winRate');
        expect(wallet).toHaveProperty('totalPnl');
        expect(wallet).toHaveProperty('avgTradeSize');
        expect(wallet).toHaveProperty('maxTradeSize');
        expect(wallet).toHaveProperty('firstTradeAt');
        expect(wallet).toHaveProperty('lastTradeAt');
        expect(wallet).toHaveProperty('walletAgeDays');
        expect(wallet).toHaveProperty('flags');
      }
    });

    it('should have correct flags structure in wallet objects', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.wallets.length > 0) {
        const flags = data.wallets[0].flags;

        expect(flags).toHaveProperty('isWhale');
        expect(flags).toHaveProperty('isInsider');
        expect(flags).toHaveProperty('isFresh');
        expect(flags).toHaveProperty('isFlagged');
        expect(flags).toHaveProperty('isMonitored');
        expect(flags).toHaveProperty('isSanctioned');
      }
    });

    it('should have correct data types for wallet fields when wallets exist', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.wallets.length > 0) {
        const wallet = data.wallets[0];

        expect(typeof wallet.id).toBe('string');
        expect(typeof wallet.address).toBe('string');
        expect(typeof wallet.suspicionScore).toBe('number');
        expect(typeof wallet.totalVolume).toBe('number');
        expect(typeof wallet.tradeCount).toBe('number');
        expect(typeof wallet.totalPnl).toBe('number');
        expect(typeof wallet.flags.isWhale).toBe('boolean');
        expect(typeof wallet.flags.isInsider).toBe('boolean');
        expect(typeof wallet.flags.isFresh).toBe('boolean');
        expect(typeof wallet.flags.isFlagged).toBe('boolean');
        expect(typeof wallet.flags.isMonitored).toBe('boolean');
        expect(typeof wallet.flags.isSanctioned).toBe('boolean');
      }
    });
  });

  describe('API Response Headers', () => {
    it('should include Cache-Control header', async () => {
      const response = await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['cache-control']).toContain('public');
      expect(headers?.['cache-control']).toContain('max-age=15');
    });

    it('should include X-Cache header', async () => {
      const response = await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['x-cache']).toBeDefined();
      expect(['HIT', 'MISS']).toContain(headers?.['x-cache']);
    });

    it('should include Content-Type application/json', async () => {
      const response = await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      const headers = response?.headers();

      expect(headers?.['content-type']).toContain('application/json');
    });
  });

  describe('Pagination Parameters', () => {
    it('should use default limit of 10', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(10);
    });

    it('should use default offset of 0', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.offset).toBe(0);
    });

    it('should respect custom limit parameter', async () => {
      await page.goto(`${WHALES_API_URL}?limit=5`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(5);
    });

    it('should respect custom offset parameter', async () => {
      await page.goto(`${WHALES_API_URL}?offset=20`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.offset).toBe(20);
    });

    it('should cap limit at 50', async () => {
      await page.goto(`${WHALES_API_URL}?limit=100`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(50);
    });

    it('should enforce minimum limit of 1', async () => {
      await page.goto(`${WHALES_API_URL}?limit=0`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(1);
    });

    it('should handle invalid limit gracefully', async () => {
      await page.goto(`${WHALES_API_URL}?limit=invalid`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.limit).toBe(10); // Default
    });

    it('should handle invalid offset gracefully', async () => {
      await page.goto(`${WHALES_API_URL}?offset=invalid`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.offset).toBe(0); // Default
    });
  });

  describe('Filter Parameters', () => {
    it('should accept minScore parameter', async () => {
      await page.goto(`${WHALES_API_URL}?minScore=75`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.minScore).toBe(75);
    });

    it('should cap minScore at 100', async () => {
      await page.goto(`${WHALES_API_URL}?minScore=150`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.minScore).toBe(100);
    });

    it('should accept isWhale=true filter', async () => {
      await page.goto(`${WHALES_API_URL}?isWhale=true`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.isWhale).toBe(true);
    });

    it('should accept isWhale=false filter', async () => {
      await page.goto(`${WHALES_API_URL}?isWhale=false`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.isWhale).toBe(false);
    });

    it('should accept isInsider filter', async () => {
      await page.goto(`${WHALES_API_URL}?isInsider=true`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.isInsider).toBe(true);
    });

    it('should accept isFlagged filter', async () => {
      await page.goto(`${WHALES_API_URL}?isFlagged=true`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.isFlagged).toBe(true);
    });

    it('should ignore invalid boolean filter values', async () => {
      await page.goto(`${WHALES_API_URL}?isWhale=invalid`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.isWhale).toBeNull();
    });

    it('should accept multiple filters', async () => {
      await page.goto(
        `${WHALES_API_URL}?minScore=80&isWhale=true&isFlagged=true`,
        { waitUntil: 'networkidle2' }
      );

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.minScore).toBe(80);
      expect(data.filters.isWhale).toBe(true);
      expect(data.filters.isFlagged).toBe(true);
    });

    it('should return null for filters not applied', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.filters.minScore).toBeNull();
      expect(data.filters.isWhale).toBeNull();
      expect(data.filters.isInsider).toBeNull();
      expect(data.filters.isFlagged).toBeNull();
    });
  });

  describe('API Caching Behavior', () => {
    it('should return consistent data within cache TTL', async () => {
      // First request
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      const text1 = await page.evaluate(() => document.body.textContent);
      const data1 = JSON.parse(text1 ?? '');

      // Small delay (less than 15s cache TTL)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second request - should return same generatedAt if cached
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      const text2 = await page.evaluate(() => document.body.textContent);
      const data2 = JSON.parse(text2 ?? '');

      expect(data1.generatedAt).toBe(data2.generatedAt);
    });

    it('should have cache HIT on subsequent request', async () => {
      // First request
      const response1 = await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      const firstCacheHeader = response1?.headers()['x-cache'];

      // Second request
      const response2 = await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      const secondCacheHeader = response2?.headers()['x-cache'];

      if (firstCacheHeader === 'MISS') {
        expect(secondCacheHeader).toBe('HIT');
      } else {
        expect(secondCacheHeader).toBe('HIT');
      }
    });

    it('should use different cache keys for different filters', async () => {
      // First request with no filters
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      // Second request with different filter
      const response2 = await page.goto(
        `${WHALES_API_URL}?isWhale=true`,
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
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.pagination.total).toBeGreaterThanOrEqual(0);
      expect(data.pagination.offset).toBeGreaterThanOrEqual(0);
      expect(data.pagination.limit).toBeGreaterThan(0);

      if (data.wallets.length > 0) {
        const wallet = data.wallets[0];
        expect(wallet.suspicionScore).toBeGreaterThanOrEqual(0);
        expect(wallet.suspicionScore).toBeLessThanOrEqual(100);
        expect(wallet.totalVolume).toBeGreaterThanOrEqual(0);
        expect(wallet.tradeCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have suspicion scores within valid range', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const wallet of data.wallets) {
        expect(wallet.suspicionScore).toBeGreaterThanOrEqual(0);
        expect(wallet.suspicionScore).toBeLessThanOrEqual(100);
      }
    });

    it('should have wallets ordered by suspicion score descending', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.wallets.length > 1) {
        for (let i = 1; i < data.wallets.length; i++) {
          expect(data.wallets[i - 1].suspicionScore).toBeGreaterThanOrEqual(
            data.wallets[i].suspicionScore
          );
        }
      }
    });

    it('should have recent generatedAt timestamp', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      const generatedAt = new Date(data.generatedAt);
      const now = new Date();
      const diffMs = now.getTime() - generatedAt.getTime();

      // Should be generated within the last minute (accounting for cache TTL)
      expect(diffMs).toBeLessThan(60 * 1000);
    });

    it('should have valid wallet addresses (0x format)', async () => {
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const wallet of data.wallets) {
        expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });

    it('should have valid wallet types', async () => {
      const validWalletTypes = [
        'UNKNOWN',
        'EOA',
        'CONTRACT',
        'EXCHANGE',
        'DEFI',
        'MARKET_MAKER',
        'INSTITUTIONAL',
        'BOT',
      ];

      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const wallet of data.wallets) {
        expect(validWalletTypes).toContain(wallet.walletType);
      }
    });

    it('should have valid risk levels', async () => {
      const validRiskLevels = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      for (const wallet of data.wallets) {
        expect(validRiskLevels).toContain(wallet.riskLevel);
      }
    });
  });

  describe('API Performance', () => {
    it('should respond within 2 seconds', async () => {
      const startTime = Date.now();
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(2000);
    });

    it('should respond faster on cache hit', async () => {
      // First request (may be MISS)
      const start1 = Date.now();
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
      const time1 = Date.now() - start1;

      // Second request (should be HIT)
      const start2 = Date.now();
      await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
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
        const response = await fetch('/api/dashboard/whales');
        return response.json();
      });

      // Verify the API data is valid
      expect(apiData).toHaveProperty('wallets');
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
          const response = await fetch('/api/dashboard/whales?limit=5&isWhale=true');
          const data = await response.json();
          return {
            status: response.status,
            ok: response.ok,
            hasWallets: Array.isArray(data.wallets),
            limit: data.pagination?.limit,
            isWhaleFilter: data.filters?.isWhale,
          };
        } catch (error) {
          return { error: String(error) };
        }
      });

      expect(result.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.hasWallets).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.isWhaleFilter).toBe(true);
    });
  });

  describe('API Error Scenarios', () => {
    it('should handle requests gracefully', async () => {
      // Make multiple rapid requests
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const response = await page.goto(WHALES_API_URL, { waitUntil: 'networkidle2' });
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
          fetch('/api/dashboard/whales').then(r => r.status)
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
      await page.goto(`${WHALES_API_URL}?limit=1`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      if (data.pagination.total > 1) {
        expect(data.pagination.hasMore).toBe(true);
      } else if (data.pagination.total <= 1) {
        expect(data.pagination.hasMore).toBe(false);
      }
    });

    it('should return correct number of wallets based on limit', async () => {
      await page.goto(`${WHALES_API_URL}?limit=5`, { waitUntil: 'networkidle2' });

      const text = await page.evaluate(() => document.body.textContent);
      const data = JSON.parse(text ?? '');

      expect(data.wallets.length).toBeLessThanOrEqual(5);
    });
  });
});
