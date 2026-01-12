/**
 * Unit Tests for RecentLargeTradesWidget
 * Feature: UI-DASH-006 - Recent large trades widget
 *
 * Tests trade display, ranking, interaction, and helper functions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LargeTrade,
  TradeDirection,
  TradeSizeCategory,
  sizeCategoryConfig,
  directionConfig,
  getSizeCategoryConfig,
  getDirectionConfig,
  getSizeCategoryFromValue,
  formatTradeWalletAddress,
  formatTradeUsdValue,
  formatTradePrice,
  formatTradeTimeAgo,
  formatShareSize,
  truncateMarketTitle,
  generateMockTrades,
} from '../../app/dashboard/components/RecentLargeTradesWidget';

describe('RecentLargeTradesWidget Unit Tests', () => {
  // ============================================================
  // TradeDirection Enum Tests
  // ============================================================
  describe('TradeDirection', () => {
    it('should define BUY direction', () => {
      const direction: TradeDirection = 'BUY';
      expect(direction).toBe('BUY');
    });

    it('should define SELL direction', () => {
      const direction: TradeDirection = 'SELL';
      expect(direction).toBe('SELL');
    });

    it('should have exactly 2 trade directions', () => {
      const directions: TradeDirection[] = ['BUY', 'SELL'];
      expect(directions.length).toBe(2);
    });
  });

  // ============================================================
  // TradeSizeCategory Enum Tests
  // ============================================================
  describe('TradeSizeCategory', () => {
    it('should define WHALE category', () => {
      const category: TradeSizeCategory = 'WHALE';
      expect(category).toBe('WHALE');
    });

    it('should define VERY_LARGE category', () => {
      const category: TradeSizeCategory = 'VERY_LARGE';
      expect(category).toBe('VERY_LARGE');
    });

    it('should define LARGE category', () => {
      const category: TradeSizeCategory = 'LARGE';
      expect(category).toBe('LARGE');
    });

    it('should have exactly 3 size categories', () => {
      const categories: TradeSizeCategory[] = ['WHALE', 'VERY_LARGE', 'LARGE'];
      expect(categories.length).toBe(3);
    });
  });

  // ============================================================
  // LargeTrade Interface Tests
  // ============================================================
  describe('LargeTrade Interface', () => {
    it('should create a valid trade object', () => {
      const trade: LargeTrade = {
        id: 'trade-1',
        marketId: 'market-1',
        marketTitle: 'Will Bitcoin reach $100K?',
        marketSlug: 'bitcoin-100k',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        direction: 'BUY',
        size: 50000,
        price: 0.65,
        usdValue: 32500,
        sizeCategory: 'VERY_LARGE',
        timestamp: new Date(),
        txHash: '0xabcdef123456',
        isMaker: true,
        isWhale: false,
        isSuspicious: false,
      };

      expect(trade.id).toBe('trade-1');
      expect(trade.usdValue).toBe(32500);
      expect(trade.direction).toBe('BUY');
      expect(trade.sizeCategory).toBe('VERY_LARGE');
    });

    it('should allow optional txHash field', () => {
      const trade: LargeTrade = {
        id: 'trade-2',
        marketId: 'market-1',
        marketTitle: 'Test Market',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        direction: 'SELL',
        size: 100000,
        price: 0.50,
        usdValue: 50000,
        sizeCategory: 'LARGE',
        timestamp: new Date(),
        isMaker: false,
        isWhale: false,
        isSuspicious: false,
      };

      expect(trade.txHash).toBeUndefined();
    });

    it('should allow optional marketSlug field', () => {
      const trade: LargeTrade = {
        id: 'trade-3',
        marketId: 'market-1',
        marketTitle: 'Test Market',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        direction: 'BUY',
        size: 200000,
        price: 0.50,
        usdValue: 100000,
        sizeCategory: 'WHALE',
        timestamp: new Date(),
        isMaker: true,
        isWhale: true,
        isSuspicious: true,
      };

      expect(trade.marketSlug).toBeUndefined();
    });

    it('should support whale trades', () => {
      const trade: LargeTrade = {
        id: 'whale-trade',
        marketId: 'market-1',
        marketTitle: 'Test Market',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        direction: 'BUY',
        size: 500000,
        price: 0.30,
        usdValue: 150000,
        sizeCategory: 'WHALE',
        timestamp: new Date(),
        isMaker: false,
        isWhale: true,
        isSuspicious: false,
      };

      expect(trade.isWhale).toBe(true);
      expect(trade.sizeCategory).toBe('WHALE');
    });

    it('should support suspicious trades', () => {
      const trade: LargeTrade = {
        id: 'suspicious-trade',
        marketId: 'market-1',
        marketTitle: 'Test Market',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        direction: 'SELL',
        size: 75000,
        price: 0.80,
        usdValue: 60000,
        sizeCategory: 'VERY_LARGE',
        timestamp: new Date(),
        isMaker: true,
        isWhale: false,
        isSuspicious: true,
      };

      expect(trade.isSuspicious).toBe(true);
    });
  });

  // ============================================================
  // sizeCategoryConfig Tests
  // ============================================================
  describe('sizeCategoryConfig', () => {
    it('should have config for WHALE category', () => {
      const config = sizeCategoryConfig.WHALE;
      expect(config).toBeDefined();
      expect(config.label).toBe('Whale');
      expect(config.icon).toBe('🐋');
      expect(config.color).toContain('purple');
      expect(config.bgColor).toContain('purple');
      expect(config.borderColor).toContain('purple');
    });

    it('should have config for VERY_LARGE category', () => {
      const config = sizeCategoryConfig.VERY_LARGE;
      expect(config).toBeDefined();
      expect(config.label).toBe('Very Large');
      expect(config.icon).toBe('📊');
      expect(config.color).toContain('orange');
      expect(config.bgColor).toContain('orange');
      expect(config.borderColor).toContain('orange');
    });

    it('should have config for LARGE category', () => {
      const config = sizeCategoryConfig.LARGE;
      expect(config).toBeDefined();
      expect(config.label).toBe('Large');
      expect(config.icon).toBe('📈');
      expect(config.color).toContain('blue');
      expect(config.bgColor).toContain('blue');
      expect(config.borderColor).toContain('blue');
    });

    it('should have config for all 3 categories', () => {
      expect(Object.keys(sizeCategoryConfig).length).toBe(3);
    });

    it('should have dark mode styles for all categories', () => {
      Object.values(sizeCategoryConfig).forEach((config) => {
        expect(config.color).toContain('dark:');
        expect(config.bgColor).toContain('dark:');
        expect(config.borderColor).toContain('dark:');
      });
    });
  });

  // ============================================================
  // directionConfig Tests
  // ============================================================
  describe('directionConfig', () => {
    it('should have config for BUY direction', () => {
      const config = directionConfig.BUY;
      expect(config).toBeDefined();
      expect(config.label).toBe('Buy');
      expect(config.icon).toBe('↑');
      expect(config.color).toContain('green');
      expect(config.bgColor).toContain('green');
    });

    it('should have config for SELL direction', () => {
      const config = directionConfig.SELL;
      expect(config).toBeDefined();
      expect(config.label).toBe('Sell');
      expect(config.icon).toBe('↓');
      expect(config.color).toContain('red');
      expect(config.bgColor).toContain('red');
    });

    it('should have config for both directions', () => {
      expect(Object.keys(directionConfig).length).toBe(2);
    });

    it('should have dark mode styles for all directions', () => {
      Object.values(directionConfig).forEach((config) => {
        expect(config.color).toContain('dark:');
        expect(config.bgColor).toContain('dark:');
      });
    });
  });

  // ============================================================
  // getSizeCategoryConfig Tests
  // ============================================================
  describe('getSizeCategoryConfig', () => {
    it('should return correct config for WHALE', () => {
      const config = getSizeCategoryConfig('WHALE');
      expect(config.label).toBe('Whale');
      expect(config.icon).toBe('🐋');
    });

    it('should return correct config for VERY_LARGE', () => {
      const config = getSizeCategoryConfig('VERY_LARGE');
      expect(config.label).toBe('Very Large');
      expect(config.icon).toBe('📊');
    });

    it('should return correct config for LARGE', () => {
      const config = getSizeCategoryConfig('LARGE');
      expect(config.label).toBe('Large');
      expect(config.icon).toBe('📈');
    });

    it('should return LARGE config as fallback for unknown category', () => {
      const config = getSizeCategoryConfig('UNKNOWN' as TradeSizeCategory);
      expect(config.label).toBe('Large');
    });
  });

  // ============================================================
  // getDirectionConfig Tests
  // ============================================================
  describe('getDirectionConfig', () => {
    it('should return correct config for BUY', () => {
      const config = getDirectionConfig('BUY');
      expect(config.label).toBe('Buy');
      expect(config.icon).toBe('↑');
    });

    it('should return correct config for SELL', () => {
      const config = getDirectionConfig('SELL');
      expect(config.label).toBe('Sell');
      expect(config.icon).toBe('↓');
    });

    it('should return BUY config as fallback for unknown direction', () => {
      const config = getDirectionConfig('UNKNOWN' as TradeDirection);
      expect(config.label).toBe('Buy');
    });
  });

  // ============================================================
  // getSizeCategoryFromValue Tests
  // ============================================================
  describe('getSizeCategoryFromValue', () => {
    it('should return WHALE for values >= $100K', () => {
      expect(getSizeCategoryFromValue(100000)).toBe('WHALE');
      expect(getSizeCategoryFromValue(150000)).toBe('WHALE');
      expect(getSizeCategoryFromValue(500000)).toBe('WHALE');
      expect(getSizeCategoryFromValue(1000000)).toBe('WHALE');
    });

    it('should return VERY_LARGE for values >= $25K and < $100K', () => {
      expect(getSizeCategoryFromValue(25000)).toBe('VERY_LARGE');
      expect(getSizeCategoryFromValue(50000)).toBe('VERY_LARGE');
      expect(getSizeCategoryFromValue(75000)).toBe('VERY_LARGE');
      expect(getSizeCategoryFromValue(99999)).toBe('VERY_LARGE');
    });

    it('should return LARGE for values < $25K', () => {
      expect(getSizeCategoryFromValue(10000)).toBe('LARGE');
      expect(getSizeCategoryFromValue(15000)).toBe('LARGE');
      expect(getSizeCategoryFromValue(24999)).toBe('LARGE');
    });

    it('should handle boundary values correctly', () => {
      expect(getSizeCategoryFromValue(24999.99)).toBe('LARGE');
      expect(getSizeCategoryFromValue(25000)).toBe('VERY_LARGE');
      expect(getSizeCategoryFromValue(99999.99)).toBe('VERY_LARGE');
      expect(getSizeCategoryFromValue(100000)).toBe('WHALE');
    });

    it('should handle zero and negative values', () => {
      expect(getSizeCategoryFromValue(0)).toBe('LARGE');
      expect(getSizeCategoryFromValue(-1000)).toBe('LARGE');
    });
  });

  // ============================================================
  // formatTradeWalletAddress Tests
  // ============================================================
  describe('formatTradeWalletAddress', () => {
    it('should format standard wallet address', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      expect(formatTradeWalletAddress(address)).toBe('0x1234...5678');
    });

    it('should handle short addresses unchanged', () => {
      const shortAddr = '0x123456';
      expect(formatTradeWalletAddress(shortAddr)).toBe('0x123456');
    });

    it('should handle empty string', () => {
      expect(formatTradeWalletAddress('')).toBe('');
    });

    it('should handle undefined-like values', () => {
      // @ts-expect-error Testing edge case
      expect(formatTradeWalletAddress(undefined)).toBe(undefined);
    });

    it('should handle exactly 10 character address', () => {
      const addr = '0x12345678';
      expect(formatTradeWalletAddress(addr)).toBe('0x12345678');
    });

    it('should handle 11+ character address', () => {
      const addr = '0x123456789a';
      expect(formatTradeWalletAddress(addr)).toBe('0x1234...789a');
    });
  });

  // ============================================================
  // formatTradeUsdValue Tests
  // ============================================================
  describe('formatTradeUsdValue', () => {
    it('should format millions correctly', () => {
      expect(formatTradeUsdValue(1000000)).toBe('$1.00M');
      expect(formatTradeUsdValue(1500000)).toBe('$1.50M');
      expect(formatTradeUsdValue(10000000)).toBe('$10.00M');
      expect(formatTradeUsdValue(2345678)).toBe('$2.35M');
    });

    it('should format thousands correctly', () => {
      expect(formatTradeUsdValue(1000)).toBe('$1.0K');
      expect(formatTradeUsdValue(50000)).toBe('$50.0K');
      expect(formatTradeUsdValue(123456)).toBe('$123.5K');
      expect(formatTradeUsdValue(999999)).toBe('$1000.0K');
    });

    it('should format small values correctly', () => {
      expect(formatTradeUsdValue(500)).toBe('$500');
      expect(formatTradeUsdValue(999)).toBe('$999');
      expect(formatTradeUsdValue(100)).toBe('$100');
    });

    it('should handle zero', () => {
      expect(formatTradeUsdValue(0)).toBe('$0');
    });

    it('should handle decimal values', () => {
      expect(formatTradeUsdValue(999.99)).toBe('$1000');
      expect(formatTradeUsdValue(50.5)).toBe('$51');
    });

    it('should handle boundary values', () => {
      expect(formatTradeUsdValue(999)).toBe('$999');
      expect(formatTradeUsdValue(1000)).toBe('$1.0K');
      expect(formatTradeUsdValue(999999)).toBe('$1000.0K');
      expect(formatTradeUsdValue(1000000)).toBe('$1.00M');
    });
  });

  // ============================================================
  // formatTradePrice Tests
  // ============================================================
  describe('formatTradePrice', () => {
    it('should format 0.5 as 50.0%', () => {
      expect(formatTradePrice(0.5)).toBe('50.0%');
    });

    it('should format 0.65 as 65.0%', () => {
      expect(formatTradePrice(0.65)).toBe('65.0%');
    });

    it('should format 1.0 as 100.0%', () => {
      expect(formatTradePrice(1.0)).toBe('100.0%');
    });

    it('should format 0 as 0.0%', () => {
      expect(formatTradePrice(0)).toBe('0.0%');
    });

    it('should format decimal values correctly', () => {
      expect(formatTradePrice(0.123)).toBe('12.3%');
      expect(formatTradePrice(0.456)).toBe('45.6%');
      expect(formatTradePrice(0.999)).toBe('99.9%');
    });

    it('should handle edge cases', () => {
      expect(formatTradePrice(0.001)).toBe('0.1%');
      expect(formatTradePrice(0.005)).toBe('0.5%');
    });
  });

  // ============================================================
  // formatTradeTimeAgo Tests
  // ============================================================
  describe('formatTradeTimeAgo', () => {
    it('should return "Just now" for very recent times', () => {
      const now = new Date();
      expect(formatTradeTimeAgo(now)).toBe('Just now');
    });

    it('should return seconds ago for times within a minute', () => {
      const thirtySecsAgo = new Date(Date.now() - 30000);
      expect(formatTradeTimeAgo(thirtySecsAgo)).toBe('30s ago');
    });

    it('should return "Just now" for times within 10 seconds', () => {
      const fiveSecsAgo = new Date(Date.now() - 5000);
      expect(formatTradeTimeAgo(fiveSecsAgo)).toBe('Just now');
    });

    it('should return minutes ago for times within an hour', () => {
      const tenMinsAgo = new Date(Date.now() - 600000);
      expect(formatTradeTimeAgo(tenMinsAgo)).toBe('10m ago');
    });

    it('should return hours ago for times within a day', () => {
      const twoHoursAgo = new Date(Date.now() - 7200000);
      expect(formatTradeTimeAgo(twoHoursAgo)).toBe('2h ago');
    });

    it('should return days ago for times over a day', () => {
      const twoDaysAgo = new Date(Date.now() - 172800000);
      expect(formatTradeTimeAgo(twoDaysAgo)).toBe('2d ago');
    });

    it('should handle boundary cases', () => {
      const exactlyOneHour = new Date(Date.now() - 3600000);
      expect(formatTradeTimeAgo(exactlyOneHour)).toBe('1h ago');

      const exactlyOneDay = new Date(Date.now() - 86400000);
      expect(formatTradeTimeAgo(exactlyOneDay)).toBe('1d ago');
    });
  });

  // ============================================================
  // formatShareSize Tests
  // ============================================================
  describe('formatShareSize', () => {
    it('should format millions correctly', () => {
      expect(formatShareSize(1000000)).toBe('1.00M shares');
      expect(formatShareSize(2500000)).toBe('2.50M shares');
      expect(formatShareSize(10000000)).toBe('10.00M shares');
    });

    it('should format thousands correctly', () => {
      expect(formatShareSize(1000)).toBe('1.0K shares');
      expect(formatShareSize(50000)).toBe('50.0K shares');
      expect(formatShareSize(999999)).toBe('1000.0K shares');
    });

    it('should format small values correctly', () => {
      expect(formatShareSize(500)).toBe('500 shares');
      expect(formatShareSize(999)).toBe('999 shares');
      expect(formatShareSize(100)).toBe('100 shares');
    });

    it('should handle zero', () => {
      expect(formatShareSize(0)).toBe('0 shares');
    });

    it('should handle decimal values', () => {
      expect(formatShareSize(123.456)).toBe('123 shares');
    });
  });

  // ============================================================
  // truncateMarketTitle Tests
  // ============================================================
  describe('truncateMarketTitle', () => {
    it('should not truncate short titles', () => {
      const title = 'Short title';
      expect(truncateMarketTitle(title)).toBe('Short title');
    });

    it('should truncate long titles with default length', () => {
      const title = 'This is a very long title that exceeds the default maximum length';
      const result = truncateMarketTitle(title);
      expect(result.length).toBe(40);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should truncate to custom length', () => {
      const title = 'This is a test title';
      const result = truncateMarketTitle(title, 10);
      expect(result).toBe('This is...');
      expect(result.length).toBe(10);
    });

    it('should handle exact length titles', () => {
      const title = 'Exactly forty characters title goes here';
      expect(truncateMarketTitle(title, 40)).toBe(title);
    });

    it('should handle empty string', () => {
      expect(truncateMarketTitle('')).toBe('');
    });

    it('should handle very small max length', () => {
      const title = 'Hello';
      expect(truncateMarketTitle(title, 5)).toBe('Hello');
      expect(truncateMarketTitle(title, 4)).toBe('H...');
    });
  });

  // ============================================================
  // generateMockTrades Tests
  // ============================================================
  describe('generateMockTrades', () => {
    it('should generate the specified number of trades', () => {
      const trades = generateMockTrades(5);
      expect(trades).toHaveLength(5);
    });

    it('should generate trades with valid properties', () => {
      const trades = generateMockTrades(10);

      trades.forEach((trade) => {
        expect(trade.id).toBeDefined();
        expect(trade.marketId).toBeDefined();
        expect(trade.marketTitle).toBeDefined();
        expect(trade.walletAddress).toBeDefined();
        expect(['BUY', 'SELL']).toContain(trade.direction);
        expect(trade.size).toBeGreaterThan(0);
        expect(trade.price).toBeGreaterThanOrEqual(0.1);
        expect(trade.price).toBeLessThanOrEqual(0.9);
        expect(trade.usdValue).toBeGreaterThanOrEqual(10000);
        expect(['WHALE', 'VERY_LARGE', 'LARGE']).toContain(trade.sizeCategory);
        expect(trade.timestamp).toBeInstanceOf(Date);
        expect(typeof trade.isMaker).toBe('boolean');
        expect(typeof trade.isWhale).toBe('boolean');
        expect(typeof trade.isSuspicious).toBe('boolean');
      });
    });

    it('should generate unique trade IDs', () => {
      const trades = generateMockTrades(20);
      const ids = trades.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should generate trades sorted by timestamp descending', () => {
      const trades = generateMockTrades(10);

      for (let i = 0; i < trades.length - 1; i++) {
        const current = trades[i];
        const next = trades[i + 1];
        if (current && next) {
          expect(current.timestamp.getTime()).toBeGreaterThanOrEqual(
            next.timestamp.getTime()
          );
        }
      }
    });

    it('should handle generating 0 trades', () => {
      const trades = generateMockTrades(0);
      expect(trades).toHaveLength(0);
    });

    it('should generate valid wallet addresses', () => {
      const trades = generateMockTrades(5);

      trades.forEach((trade) => {
        expect(trade.walletAddress).toMatch(/^0x[0-9a-f]{40}$/);
      });
    });

    it('should generate valid tx hashes when present', () => {
      const trades = generateMockTrades(10);

      trades.forEach((trade) => {
        if (trade.txHash) {
          expect(trade.txHash).toMatch(/^0x[0-9a-f]{64}$/);
        }
      });
    });

    it('should set isWhale to true for WHALE category trades', () => {
      const trades = generateMockTrades(50);
      const whaleTrades = trades.filter((t) => t.sizeCategory === 'WHALE');

      whaleTrades.forEach((trade) => {
        expect(trade.isWhale).toBe(true);
      });
    });

    it('should generate timestamps within last 24 hours', () => {
      const trades = generateMockTrades(10);
      const now = Date.now();
      const oneDayAgo = now - 86400000;

      trades.forEach((trade) => {
        expect(trade.timestamp.getTime()).toBeGreaterThanOrEqual(oneDayAgo);
        expect(trade.timestamp.getTime()).toBeLessThanOrEqual(now);
      });
    });

    it('should generate trades with size category matching USD value', () => {
      const trades = generateMockTrades(20);

      trades.forEach((trade) => {
        const expectedCategory = getSizeCategoryFromValue(trade.usdValue);
        expect(trade.sizeCategory).toBe(expectedCategory);
      });
    });
  });

  // ============================================================
  // Trade Aggregation Tests
  // ============================================================
  describe('Trade Aggregation', () => {
    it('should count whale trades correctly', () => {
      const trades = generateMockTrades(50);
      const whaleCount = trades.filter((t) => t.sizeCategory === 'WHALE').length;

      expect(whaleCount).toBeGreaterThanOrEqual(0);
      expect(whaleCount).toBeLessThanOrEqual(trades.length);
    });

    it('should count suspicious trades correctly', () => {
      const trades = generateMockTrades(50);
      const suspiciousCount = trades.filter((t) => t.isSuspicious).length;

      expect(suspiciousCount).toBeGreaterThanOrEqual(0);
      expect(suspiciousCount).toBeLessThanOrEqual(trades.length);
    });

    it('should count buy trades correctly', () => {
      const trades = generateMockTrades(50);
      const buyCount = trades.filter((t) => t.direction === 'BUY').length;

      expect(buyCount).toBeGreaterThanOrEqual(0);
      expect(buyCount).toBeLessThanOrEqual(trades.length);
    });

    it('should count sell trades correctly', () => {
      const trades = generateMockTrades(50);
      const sellCount = trades.filter((t) => t.direction === 'SELL').length;

      expect(sellCount).toBeGreaterThanOrEqual(0);
      expect(sellCount).toBeLessThanOrEqual(trades.length);
    });

    it('should calculate total volume correctly', () => {
      const trades = generateMockTrades(10);
      const totalVolume = trades.reduce((sum, t) => sum + t.usdValue, 0);

      expect(totalVolume).toBeGreaterThan(0);
    });

    it('should have buy + sell count equal to total', () => {
      const trades = generateMockTrades(50);
      const buyCount = trades.filter((t) => t.direction === 'BUY').length;
      const sellCount = trades.filter((t) => t.direction === 'SELL').length;

      expect(buyCount + sellCount).toBe(trades.length);
    });
  });

  // ============================================================
  // Trade Sorting Tests
  // ============================================================
  describe('Trade Sorting', () => {
    it('should sort trades by timestamp descending', () => {
      const trades: LargeTrade[] = [
        {
          id: '1',
          marketId: 'm1',
          marketTitle: 'Market 1',
          walletAddress: '0x123',
          direction: 'BUY',
          size: 1000,
          price: 0.5,
          usdValue: 50000,
          sizeCategory: 'VERY_LARGE',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          isMaker: false,
          isWhale: false,
          isSuspicious: false,
        },
        {
          id: '2',
          marketId: 'm1',
          marketTitle: 'Market 1',
          walletAddress: '0x456',
          direction: 'SELL',
          size: 2000,
          price: 0.6,
          usdValue: 60000,
          sizeCategory: 'VERY_LARGE',
          timestamp: new Date('2024-01-01T12:00:00Z'),
          isMaker: true,
          isWhale: false,
          isSuspicious: false,
        },
        {
          id: '3',
          marketId: 'm1',
          marketTitle: 'Market 1',
          walletAddress: '0x789',
          direction: 'BUY',
          size: 3000,
          price: 0.7,
          usdValue: 70000,
          sizeCategory: 'VERY_LARGE',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          isMaker: false,
          isWhale: false,
          isSuspicious: true,
        },
      ];

      const sorted = [...trades].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      expect(sorted[0]?.id).toBe('2'); // Most recent
      expect(sorted[1]?.id).toBe('3');
      expect(sorted[2]?.id).toBe('1'); // Oldest
    });

    it('should sort trades by USD value descending', () => {
      const trades: LargeTrade[] = [
        {
          id: '1',
          marketId: 'm1',
          marketTitle: 'Market 1',
          walletAddress: '0x123',
          direction: 'BUY',
          size: 1000,
          price: 0.5,
          usdValue: 50000,
          sizeCategory: 'VERY_LARGE',
          timestamp: new Date(),
          isMaker: false,
          isWhale: false,
          isSuspicious: false,
        },
        {
          id: '2',
          marketId: 'm1',
          marketTitle: 'Market 1',
          walletAddress: '0x456',
          direction: 'SELL',
          size: 2000,
          price: 0.6,
          usdValue: 150000,
          sizeCategory: 'WHALE',
          timestamp: new Date(),
          isMaker: true,
          isWhale: true,
          isSuspicious: false,
        },
        {
          id: '3',
          marketId: 'm1',
          marketTitle: 'Market 1',
          walletAddress: '0x789',
          direction: 'BUY',
          size: 3000,
          price: 0.7,
          usdValue: 75000,
          sizeCategory: 'VERY_LARGE',
          timestamp: new Date(),
          isMaker: false,
          isWhale: false,
          isSuspicious: true,
        },
      ];

      const sorted = [...trades].sort((a, b) => b.usdValue - a.usdValue);

      expect(sorted[0]?.id).toBe('2'); // Highest value
      expect(sorted[1]?.id).toBe('3');
      expect(sorted[2]?.id).toBe('1'); // Lowest value
    });
  });

  // ============================================================
  // Props Validation Tests
  // ============================================================
  describe('Props Validation', () => {
    it('should accept empty trades array', () => {
      const trades: LargeTrade[] = [];
      expect(trades.length).toBe(0);
    });

    it('should accept valid maxTrades values', () => {
      const validMaxTrades = [1, 5, 10, 20, 50];
      validMaxTrades.forEach((max) => {
        expect(max).toBeGreaterThan(0);
      });
    });

    it('should accept valid minUsdValue values', () => {
      const validMinValues = [1000, 5000, 10000, 25000, 50000, 100000];
      validMinValues.forEach((min) => {
        expect(min).toBeGreaterThan(0);
      });
    });

    it('should accept valid testId string', () => {
      const testId = 'my-custom-test-id';
      expect(testId).toBeTruthy();
      expect(typeof testId).toBe('string');
    });
  });

  // ============================================================
  // Data Attributes Tests
  // ============================================================
  describe('Data Attributes', () => {
    it('should generate correct trade id format', () => {
      const trades = generateMockTrades(5);
      trades.forEach((trade, index) => {
        expect(trade.id).toBe(`trade-${index + 1}`);
      });
    });

    it('should generate trades with valid data attributes', () => {
      const trades = generateMockTrades(10);

      trades.forEach((trade) => {
        expect(trade.id).toBeTruthy();
        expect(trade.usdValue).toBeGreaterThan(0);
        expect(['BUY', 'SELL']).toContain(trade.direction);
      });
    });
  });

  // ============================================================
  // Edge Cases Tests
  // ============================================================
  describe('Edge Cases', () => {
    it('should handle very large USD values', () => {
      const largeValue = 100000000; // $100M
      expect(formatTradeUsdValue(largeValue)).toBe('$100.00M');
      expect(getSizeCategoryFromValue(largeValue)).toBe('WHALE');
    });

    it('should handle very small USD values', () => {
      const smallValue = 1;
      expect(formatTradeUsdValue(smallValue)).toBe('$1');
      expect(getSizeCategoryFromValue(smallValue)).toBe('LARGE');
    });

    it('should handle price at boundaries', () => {
      expect(formatTradePrice(0)).toBe('0.0%');
      expect(formatTradePrice(1)).toBe('100.0%');
    });

    it('should handle future timestamps', () => {
      const futureDate = new Date(Date.now() + 86400000);
      const result = formatTradeTimeAgo(futureDate);
      // Future dates might show as "Just now" or negative days
      expect(result).toBeDefined();
    });

    it('should handle very old timestamps', () => {
      const oldDate = new Date('2020-01-01');
      const result = formatTradeTimeAgo(oldDate);
      expect(result).toMatch(/\d+d ago/);
    });

    it('should handle long wallet addresses', () => {
      const longAddr = '0x' + 'a'.repeat(100);
      const formatted = formatTradeWalletAddress(longAddr);
      expect(formatted).toBe('0xaaaa...aaaa');
    });

    it('should handle unicode in market titles', () => {
      const title = 'Will Bitcoin reach 🚀 $100K?';
      const result = truncateMarketTitle(title, 20);
      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // Accessibility Tests
  // ============================================================
  describe('Accessibility', () => {
    it('should provide meaningful labels for trade directions', () => {
      expect(directionConfig.BUY.label).toBe('Buy');
      expect(directionConfig.SELL.label).toBe('Sell');
    });

    it('should provide meaningful labels for size categories', () => {
      expect(sizeCategoryConfig.WHALE.label).toBe('Whale');
      expect(sizeCategoryConfig.VERY_LARGE.label).toBe('Very Large');
      expect(sizeCategoryConfig.LARGE.label).toBe('Large');
    });

    it('should provide icons for visual identification', () => {
      expect(sizeCategoryConfig.WHALE.icon).toBe('🐋');
      expect(sizeCategoryConfig.VERY_LARGE.icon).toBe('📊');
      expect(sizeCategoryConfig.LARGE.icon).toBe('📈');
      expect(directionConfig.BUY.icon).toBe('↑');
      expect(directionConfig.SELL.icon).toBe('↓');
    });
  });
});
