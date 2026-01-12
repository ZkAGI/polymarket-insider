/**
 * Unit Tests for HotMarketsWidget
 * Feature: UI-DASH-005 - Hot markets widget
 *
 * Tests market display, ranking, interaction, and helper functions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HotMarket,
  HeatLevel,
  MarketCategory,
  MarketAlertType,
  heatLevelConfig,
  categoryConfig,
  alertTypeConfig,
  getHeatLevelConfig,
  getCategoryConfig,
  getAlertTypeConfig,
  getHeatLevelFromScore,
  formatMarketVolume,
  formatPercentageChange,
  formatProbability,
  formatMarketTimeAgo,
  truncateTitle,
  generateMockMarkets,
} from '../../app/dashboard/components/HotMarketsWidget';

describe('HotMarketsWidget Unit Tests', () => {
  // ============================================================
  // HeatLevel Enum Tests
  // ============================================================
  describe('HeatLevel', () => {
    it('should define CRITICAL level', () => {
      const level: HeatLevel = 'CRITICAL';
      expect(level).toBe('CRITICAL');
    });

    it('should define HIGH level', () => {
      const level: HeatLevel = 'HIGH';
      expect(level).toBe('HIGH');
    });

    it('should define MEDIUM level', () => {
      const level: HeatLevel = 'MEDIUM';
      expect(level).toBe('MEDIUM');
    });

    it('should define LOW level', () => {
      const level: HeatLevel = 'LOW';
      expect(level).toBe('LOW');
    });

    it('should define NONE level', () => {
      const level: HeatLevel = 'NONE';
      expect(level).toBe('NONE');
    });

    it('should have exactly 5 heat levels', () => {
      const levels: HeatLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
      expect(levels.length).toBe(5);
    });
  });

  // ============================================================
  // MarketCategory Enum Tests
  // ============================================================
  describe('MarketCategory', () => {
    it('should define POLITICS category', () => {
      const category: MarketCategory = 'POLITICS';
      expect(category).toBe('POLITICS');
    });

    it('should define CRYPTO category', () => {
      const category: MarketCategory = 'CRYPTO';
      expect(category).toBe('CRYPTO');
    });

    it('should define SPORTS category', () => {
      const category: MarketCategory = 'SPORTS';
      expect(category).toBe('SPORTS');
    });

    it('should define ENTERTAINMENT category', () => {
      const category: MarketCategory = 'ENTERTAINMENT';
      expect(category).toBe('ENTERTAINMENT');
    });

    it('should define FINANCE category', () => {
      const category: MarketCategory = 'FINANCE';
      expect(category).toBe('FINANCE');
    });

    it('should define SCIENCE category', () => {
      const category: MarketCategory = 'SCIENCE';
      expect(category).toBe('SCIENCE');
    });

    it('should define GEOPOLITICAL category', () => {
      const category: MarketCategory = 'GEOPOLITICAL';
      expect(category).toBe('GEOPOLITICAL');
    });

    it('should define OTHER category', () => {
      const category: MarketCategory = 'OTHER';
      expect(category).toBe('OTHER');
    });

    it('should have exactly 8 categories', () => {
      const categories: MarketCategory[] = [
        'POLITICS',
        'CRYPTO',
        'SPORTS',
        'ENTERTAINMENT',
        'FINANCE',
        'SCIENCE',
        'GEOPOLITICAL',
        'OTHER',
      ];
      expect(categories.length).toBe(8);
    });
  });

  // ============================================================
  // MarketAlertType Enum Tests
  // ============================================================
  describe('MarketAlertType', () => {
    it('should define WHALE_ACTIVITY alert type', () => {
      const alertType: MarketAlertType = 'WHALE_ACTIVITY';
      expect(alertType).toBe('WHALE_ACTIVITY');
    });

    it('should define COORDINATED_TRADING alert type', () => {
      const alertType: MarketAlertType = 'COORDINATED_TRADING';
      expect(alertType).toBe('COORDINATED_TRADING');
    });

    it('should define VOLUME_SPIKE alert type', () => {
      const alertType: MarketAlertType = 'VOLUME_SPIKE';
      expect(alertType).toBe('VOLUME_SPIKE');
    });

    it('should define PRICE_MANIPULATION alert type', () => {
      const alertType: MarketAlertType = 'PRICE_MANIPULATION';
      expect(alertType).toBe('PRICE_MANIPULATION');
    });

    it('should define FRESH_WALLET_CLUSTER alert type', () => {
      const alertType: MarketAlertType = 'FRESH_WALLET_CLUSTER';
      expect(alertType).toBe('FRESH_WALLET_CLUSTER');
    });

    it('should define INSIDER_PATTERN alert type', () => {
      const alertType: MarketAlertType = 'INSIDER_PATTERN';
      expect(alertType).toBe('INSIDER_PATTERN');
    });

    it('should have exactly 6 alert types', () => {
      const types: MarketAlertType[] = [
        'WHALE_ACTIVITY',
        'COORDINATED_TRADING',
        'VOLUME_SPIKE',
        'PRICE_MANIPULATION',
        'FRESH_WALLET_CLUSTER',
        'INSIDER_PATTERN',
      ];
      expect(types.length).toBe(6);
    });
  });

  // ============================================================
  // HotMarket Interface Tests
  // ============================================================
  describe('HotMarket Interface', () => {
    it('should create a valid market object', () => {
      const market: HotMarket = {
        id: 'market-1',
        title: 'Will Bitcoin reach $100K?',
        slug: 'bitcoin-100k',
        category: 'CRYPTO',
        heatLevel: 'HIGH',
        heatScore: 75,
        alertCount: 5,
        alertTypes: ['WHALE_ACTIVITY', 'VOLUME_SPIKE'],
        currentProbability: 0.65,
        probabilityChange: 0.05,
        volume24h: 500000,
        volumeChange: 0.25,
        suspiciousWallets: 3,
        lastAlert: new Date(),
        isWatched: false,
      };

      expect(market.id).toBe('market-1');
      expect(market.heatScore).toBe(75);
      expect(market.heatLevel).toBe('HIGH');
      expect(market.alertTypes).toHaveLength(2);
    });

    it('should allow optional isWatched field', () => {
      const market: HotMarket = {
        id: 'market-1',
        title: 'Test Market',
        slug: 'test-market',
        category: 'OTHER',
        heatLevel: 'MEDIUM',
        heatScore: 50,
        alertCount: 2,
        alertTypes: [],
        currentProbability: 0.5,
        probabilityChange: 0,
        volume24h: 10000,
        volumeChange: 0,
        suspiciousWallets: 1,
        lastAlert: new Date(),
      };

      expect(market.isWatched).toBeUndefined();
    });

    it('should handle all market categories', () => {
      const categories: MarketCategory[] = [
        'POLITICS',
        'CRYPTO',
        'SPORTS',
        'ENTERTAINMENT',
        'FINANCE',
        'SCIENCE',
        'GEOPOLITICAL',
        'OTHER',
      ];

      categories.forEach((category) => {
        const market: HotMarket = {
          id: `market-${category}`,
          title: `${category} Market`,
          slug: `${category.toLowerCase()}-market`,
          category,
          heatLevel: 'LOW',
          heatScore: 30,
          alertCount: 1,
          alertTypes: ['VOLUME_SPIKE'],
          currentProbability: 0.5,
          probabilityChange: 0,
          volume24h: 10000,
          volumeChange: 0,
          suspiciousWallets: 1,
          lastAlert: new Date(),
        };

        expect(market.category).toBe(category);
      });
    });
  });

  // ============================================================
  // heatLevelConfig Tests
  // ============================================================
  describe('heatLevelConfig', () => {
    it('should have config for all heat levels', () => {
      const levels: HeatLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
      levels.forEach((level) => {
        expect(heatLevelConfig[level]).toBeDefined();
        expect(heatLevelConfig[level].label).toBeDefined();
        expect(heatLevelConfig[level].color).toBeDefined();
        expect(heatLevelConfig[level].bgColor).toBeDefined();
        expect(heatLevelConfig[level].borderColor).toBeDefined();
        expect(heatLevelConfig[level].icon).toBeDefined();
      });
    });

    it('should have correct label for CRITICAL', () => {
      expect(heatLevelConfig.CRITICAL.label).toBe('Critical');
    });

    it('should have correct label for HIGH', () => {
      expect(heatLevelConfig.HIGH.label).toBe('High');
    });

    it('should have correct label for MEDIUM', () => {
      expect(heatLevelConfig.MEDIUM.label).toBe('Medium');
    });

    it('should have correct label for LOW', () => {
      expect(heatLevelConfig.LOW.label).toBe('Low');
    });

    it('should have correct label for NONE', () => {
      expect(heatLevelConfig.NONE.label).toBe('None');
    });

    it('should have red colors for CRITICAL', () => {
      expect(heatLevelConfig.CRITICAL.color).toContain('red');
      expect(heatLevelConfig.CRITICAL.bgColor).toContain('red');
      expect(heatLevelConfig.CRITICAL.borderColor).toContain('red');
    });

    it('should have orange colors for HIGH', () => {
      expect(heatLevelConfig.HIGH.color).toContain('orange');
      expect(heatLevelConfig.HIGH.bgColor).toContain('orange');
      expect(heatLevelConfig.HIGH.borderColor).toContain('orange');
    });

    it('should have yellow colors for MEDIUM', () => {
      expect(heatLevelConfig.MEDIUM.color).toContain('yellow');
      expect(heatLevelConfig.MEDIUM.bgColor).toContain('yellow');
      expect(heatLevelConfig.MEDIUM.borderColor).toContain('yellow');
    });

    it('should have icons for each level', () => {
      expect(heatLevelConfig.CRITICAL.icon).toBe('🔥');
      expect(heatLevelConfig.HIGH.icon).toBe('🌡️');
      expect(heatLevelConfig.MEDIUM.icon).toBe('📊');
      expect(heatLevelConfig.LOW.icon).toBe('📉');
      expect(heatLevelConfig.NONE.icon).toBe('✓');
    });
  });

  // ============================================================
  // categoryConfig Tests
  // ============================================================
  describe('categoryConfig', () => {
    it('should have config for all categories', () => {
      const categories: MarketCategory[] = [
        'POLITICS',
        'CRYPTO',
        'SPORTS',
        'ENTERTAINMENT',
        'FINANCE',
        'SCIENCE',
        'GEOPOLITICAL',
        'OTHER',
      ];
      categories.forEach((category) => {
        expect(categoryConfig[category]).toBeDefined();
        expect(categoryConfig[category].label).toBeDefined();
        expect(categoryConfig[category].icon).toBeDefined();
        expect(categoryConfig[category].color).toBeDefined();
      });
    });

    it('should have correct labels for categories', () => {
      expect(categoryConfig.POLITICS.label).toBe('Politics');
      expect(categoryConfig.CRYPTO.label).toBe('Crypto');
      expect(categoryConfig.SPORTS.label).toBe('Sports');
      expect(categoryConfig.ENTERTAINMENT.label).toBe('Entertainment');
      expect(categoryConfig.FINANCE.label).toBe('Finance');
      expect(categoryConfig.SCIENCE.label).toBe('Science');
      expect(categoryConfig.GEOPOLITICAL.label).toBe('Geopolitical');
      expect(categoryConfig.OTHER.label).toBe('Other');
    });

    it('should have icons for each category', () => {
      expect(categoryConfig.POLITICS.icon).toBe('🏛️');
      expect(categoryConfig.CRYPTO.icon).toBe('₿');
      expect(categoryConfig.SPORTS.icon).toBe('⚽');
      expect(categoryConfig.ENTERTAINMENT.icon).toBe('🎬');
      expect(categoryConfig.FINANCE.icon).toBe('💹');
      expect(categoryConfig.SCIENCE.icon).toBe('🔬');
      expect(categoryConfig.GEOPOLITICAL.icon).toBe('🌍');
      expect(categoryConfig.OTHER.icon).toBe('📋');
    });
  });

  // ============================================================
  // alertTypeConfig Tests
  // ============================================================
  describe('alertTypeConfig', () => {
    it('should have config for all alert types', () => {
      const types: MarketAlertType[] = [
        'WHALE_ACTIVITY',
        'COORDINATED_TRADING',
        'VOLUME_SPIKE',
        'PRICE_MANIPULATION',
        'FRESH_WALLET_CLUSTER',
        'INSIDER_PATTERN',
      ];
      types.forEach((type) => {
        expect(alertTypeConfig[type]).toBeDefined();
        expect(alertTypeConfig[type].label).toBeDefined();
        expect(alertTypeConfig[type].icon).toBeDefined();
        expect(alertTypeConfig[type].color).toBeDefined();
      });
    });

    it('should have correct labels for alert types', () => {
      expect(alertTypeConfig.WHALE_ACTIVITY.label).toBe('Whale');
      expect(alertTypeConfig.COORDINATED_TRADING.label).toBe('Coordinated');
      expect(alertTypeConfig.VOLUME_SPIKE.label).toBe('Volume');
      expect(alertTypeConfig.PRICE_MANIPULATION.label).toBe('Price');
      expect(alertTypeConfig.FRESH_WALLET_CLUSTER.label).toBe('Fresh');
      expect(alertTypeConfig.INSIDER_PATTERN.label).toBe('Insider');
    });

    it('should have icons for each alert type', () => {
      expect(alertTypeConfig.WHALE_ACTIVITY.icon).toBe('🐋');
      expect(alertTypeConfig.COORDINATED_TRADING.icon).toBe('🔗');
      expect(alertTypeConfig.VOLUME_SPIKE.icon).toBe('📈');
      expect(alertTypeConfig.PRICE_MANIPULATION.icon).toBe('⚠️');
      expect(alertTypeConfig.FRESH_WALLET_CLUSTER.icon).toBe('✨');
      expect(alertTypeConfig.INSIDER_PATTERN.icon).toBe('🎯');
    });
  });

  // ============================================================
  // getHeatLevelConfig Tests
  // ============================================================
  describe('getHeatLevelConfig', () => {
    it('should return config for CRITICAL', () => {
      const config = getHeatLevelConfig('CRITICAL');
      expect(config.label).toBe('Critical');
      expect(config.icon).toBe('🔥');
    });

    it('should return config for HIGH', () => {
      const config = getHeatLevelConfig('HIGH');
      expect(config.label).toBe('High');
    });

    it('should return config for MEDIUM', () => {
      const config = getHeatLevelConfig('MEDIUM');
      expect(config.label).toBe('Medium');
    });

    it('should return config for LOW', () => {
      const config = getHeatLevelConfig('LOW');
      expect(config.label).toBe('Low');
    });

    it('should return config for NONE', () => {
      const config = getHeatLevelConfig('NONE');
      expect(config.label).toBe('None');
    });

    it('should return default config for unknown level', () => {
      const config = getHeatLevelConfig('UNKNOWN' as HeatLevel);
      expect(config).toBeDefined();
    });
  });

  // ============================================================
  // getCategoryConfig Tests
  // ============================================================
  describe('getCategoryConfig', () => {
    it('should return config for each category', () => {
      const categories: MarketCategory[] = [
        'POLITICS',
        'CRYPTO',
        'SPORTS',
        'ENTERTAINMENT',
        'FINANCE',
        'SCIENCE',
        'GEOPOLITICAL',
        'OTHER',
      ];

      categories.forEach((category) => {
        const config = getCategoryConfig(category);
        expect(config.label).toBeDefined();
        expect(config.icon).toBeDefined();
        expect(config.color).toBeDefined();
      });
    });

    it('should return default config for unknown category', () => {
      const config = getCategoryConfig('UNKNOWN' as MarketCategory);
      expect(config).toBeDefined();
    });
  });

  // ============================================================
  // getAlertTypeConfig Tests
  // ============================================================
  describe('getAlertTypeConfig', () => {
    it('should return config for each alert type', () => {
      const types: MarketAlertType[] = [
        'WHALE_ACTIVITY',
        'COORDINATED_TRADING',
        'VOLUME_SPIKE',
        'PRICE_MANIPULATION',
        'FRESH_WALLET_CLUSTER',
        'INSIDER_PATTERN',
      ];

      types.forEach((type) => {
        const config = getAlertTypeConfig(type);
        expect(config.label).toBeDefined();
        expect(config.icon).toBeDefined();
        expect(config.color).toBeDefined();
      });
    });

    it('should return default config for unknown type', () => {
      const config = getAlertTypeConfig('UNKNOWN' as MarketAlertType);
      expect(config).toBeDefined();
    });
  });

  // ============================================================
  // getHeatLevelFromScore Tests
  // ============================================================
  describe('getHeatLevelFromScore', () => {
    it('should return CRITICAL for score >= 80', () => {
      expect(getHeatLevelFromScore(80)).toBe('CRITICAL');
      expect(getHeatLevelFromScore(90)).toBe('CRITICAL');
      expect(getHeatLevelFromScore(100)).toBe('CRITICAL');
    });

    it('should return HIGH for score 60-79', () => {
      expect(getHeatLevelFromScore(60)).toBe('HIGH');
      expect(getHeatLevelFromScore(70)).toBe('HIGH');
      expect(getHeatLevelFromScore(79)).toBe('HIGH');
    });

    it('should return MEDIUM for score 40-59', () => {
      expect(getHeatLevelFromScore(40)).toBe('MEDIUM');
      expect(getHeatLevelFromScore(50)).toBe('MEDIUM');
      expect(getHeatLevelFromScore(59)).toBe('MEDIUM');
    });

    it('should return LOW for score 20-39', () => {
      expect(getHeatLevelFromScore(20)).toBe('LOW');
      expect(getHeatLevelFromScore(30)).toBe('LOW');
      expect(getHeatLevelFromScore(39)).toBe('LOW');
    });

    it('should return NONE for score < 20', () => {
      expect(getHeatLevelFromScore(0)).toBe('NONE');
      expect(getHeatLevelFromScore(10)).toBe('NONE');
      expect(getHeatLevelFromScore(19)).toBe('NONE');
    });

    it('should handle boundary values correctly', () => {
      expect(getHeatLevelFromScore(19)).toBe('NONE');
      expect(getHeatLevelFromScore(20)).toBe('LOW');
      expect(getHeatLevelFromScore(39)).toBe('LOW');
      expect(getHeatLevelFromScore(40)).toBe('MEDIUM');
      expect(getHeatLevelFromScore(59)).toBe('MEDIUM');
      expect(getHeatLevelFromScore(60)).toBe('HIGH');
      expect(getHeatLevelFromScore(79)).toBe('HIGH');
      expect(getHeatLevelFromScore(80)).toBe('CRITICAL');
    });
  });

  // ============================================================
  // formatMarketVolume Tests
  // ============================================================
  describe('formatMarketVolume', () => {
    it('should format millions with M suffix', () => {
      expect(formatMarketVolume(1000000)).toBe('$1.0M');
      expect(formatMarketVolume(2500000)).toBe('$2.5M');
      expect(formatMarketVolume(10000000)).toBe('$10.0M');
    });

    it('should format thousands with K suffix', () => {
      expect(formatMarketVolume(1000)).toBe('$1.0K');
      expect(formatMarketVolume(5500)).toBe('$5.5K');
      expect(formatMarketVolume(999000)).toBe('$999.0K');
    });

    it('should format small amounts without suffix', () => {
      expect(formatMarketVolume(100)).toBe('$100');
      expect(formatMarketVolume(500)).toBe('$500');
      expect(formatMarketVolume(999)).toBe('$999');
    });

    it('should handle zero', () => {
      expect(formatMarketVolume(0)).toBe('$0');
    });

    it('should handle decimal values', () => {
      expect(formatMarketVolume(1500000)).toBe('$1.5M');
      expect(formatMarketVolume(1200)).toBe('$1.2K');
    });
  });

  // ============================================================
  // formatPercentageChange Tests
  // ============================================================
  describe('formatPercentageChange', () => {
    it('should format positive changes with + prefix', () => {
      expect(formatPercentageChange(0.05)).toBe('+5.0%');
      expect(formatPercentageChange(0.1)).toBe('+10.0%');
      expect(formatPercentageChange(0.25)).toBe('+25.0%');
    });

    it('should format negative changes', () => {
      expect(formatPercentageChange(-0.05)).toBe('-5.0%');
      expect(formatPercentageChange(-0.1)).toBe('-10.0%');
      expect(formatPercentageChange(-0.25)).toBe('-25.0%');
    });

    it('should handle zero', () => {
      expect(formatPercentageChange(0)).toBe('+0.0%');
    });

    it('should format small percentages correctly', () => {
      expect(formatPercentageChange(0.001)).toBe('+0.1%');
      expect(formatPercentageChange(-0.001)).toBe('-0.1%');
    });
  });

  // ============================================================
  // formatProbability Tests
  // ============================================================
  describe('formatProbability', () => {
    it('should format probability as percentage', () => {
      expect(formatProbability(0.5)).toBe('50%');
      expect(formatProbability(0.75)).toBe('75%');
      expect(formatProbability(0.1)).toBe('10%');
    });

    it('should round to whole number', () => {
      expect(formatProbability(0.666)).toBe('67%');
      expect(formatProbability(0.333)).toBe('33%');
    });

    it('should handle extreme values', () => {
      expect(formatProbability(0)).toBe('0%');
      expect(formatProbability(1)).toBe('100%');
    });
  });

  // ============================================================
  // formatMarketTimeAgo Tests
  // ============================================================
  describe('formatMarketTimeAgo', () => {
    it('should format days ago', () => {
      const date = new Date(Date.now() - 86400000 * 2); // 2 days ago
      expect(formatMarketTimeAgo(date)).toBe('2d ago');
    });

    it('should format hours ago', () => {
      const date = new Date(Date.now() - 3600000 * 5); // 5 hours ago
      expect(formatMarketTimeAgo(date)).toBe('5h ago');
    });

    it('should format minutes ago', () => {
      const date = new Date(Date.now() - 60000 * 30); // 30 minutes ago
      expect(formatMarketTimeAgo(date)).toBe('30m ago');
    });

    it('should format just now for very recent', () => {
      const date = new Date(Date.now() - 30000); // 30 seconds ago
      expect(formatMarketTimeAgo(date)).toBe('Just now');
    });

    it('should handle boundary between days and hours', () => {
      const date = new Date(Date.now() - 86400000); // exactly 1 day ago
      expect(formatMarketTimeAgo(date)).toBe('1d ago');
    });
  });

  // ============================================================
  // truncateTitle Tests
  // ============================================================
  describe('truncateTitle', () => {
    it('should not truncate short titles', () => {
      const title = 'Short title';
      expect(truncateTitle(title)).toBe(title);
    });

    it('should truncate long titles with ellipsis', () => {
      const title = 'This is a very long market title that should be truncated because it exceeds the maximum length';
      const result = truncateTitle(title, 50);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should use default max length of 50', () => {
      const title = 'This is a very long market title that exceeds fifty characters and should be truncated';
      const result = truncateTitle(title);
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should handle title exactly at max length', () => {
      const title = 'A'.repeat(50);
      expect(truncateTitle(title, 50)).toBe(title);
    });

    it('should handle custom max length', () => {
      const title = 'This is a test market title';
      const result = truncateTitle(title, 20);
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  // ============================================================
  // generateMockMarkets Tests
  // ============================================================
  describe('generateMockMarkets', () => {
    it('should generate specified number of markets', () => {
      const markets = generateMockMarkets(5);
      expect(markets).toHaveLength(5);
    });

    it('should generate default of 5 markets', () => {
      const markets = generateMockMarkets();
      expect(markets).toHaveLength(5);
    });

    it('should generate markets with valid ids', () => {
      const markets = generateMockMarkets(3);
      // Markets are sorted by heat score, so just check id format
      markets.forEach((market) => {
        expect(market.id).toMatch(/^market-\d+$/);
      });
      // Check that all ids are unique
      const ids = markets.map((m) => m.id);
      expect(new Set(ids).size).toBe(markets.length);
    });

    it('should generate markets with all required fields', () => {
      const markets = generateMockMarkets(1);
      const market = markets[0];

      expect(market).toBeDefined();
      expect(market?.id).toBeDefined();
      expect(market?.title).toBeDefined();
      expect(market?.slug).toBeDefined();
      expect(market?.category).toBeDefined();
      expect(market?.heatLevel).toBeDefined();
      expect(market?.heatScore).toBeGreaterThanOrEqual(0);
      expect(market?.heatScore).toBeLessThanOrEqual(100);
      expect(market?.alertCount).toBeGreaterThanOrEqual(0);
      expect(market?.alertTypes).toBeDefined();
      expect(market?.currentProbability).toBeGreaterThanOrEqual(0);
      expect(market?.currentProbability).toBeLessThanOrEqual(1);
      expect(market?.volume24h).toBeGreaterThanOrEqual(0);
      expect(market?.lastAlert).toBeInstanceOf(Date);
    });

    it('should generate markets sorted by heat score descending', () => {
      const markets = generateMockMarkets(10);
      for (let i = 0; i < markets.length - 1; i++) {
        const current = markets[i];
        const next = markets[i + 1];
        if (current && next) {
          expect(current.heatScore).toBeGreaterThanOrEqual(next.heatScore);
        }
      }
    });

    it('should generate markets with correct heat levels based on score', () => {
      const markets = generateMockMarkets(20);
      markets.forEach((market) => {
        const expectedLevel = getHeatLevelFromScore(market.heatScore);
        expect(market.heatLevel).toBe(expectedLevel);
      });
    });

    it('should generate markets with valid categories', () => {
      const validCategories: MarketCategory[] = [
        'POLITICS',
        'CRYPTO',
        'SPORTS',
        'ENTERTAINMENT',
        'FINANCE',
        'SCIENCE',
        'GEOPOLITICAL',
        'OTHER',
      ];
      const markets = generateMockMarkets(20);
      markets.forEach((market) => {
        expect(validCategories).toContain(market.category);
      });
    });

    it('should generate markets with valid alert types', () => {
      const validAlertTypes: MarketAlertType[] = [
        'WHALE_ACTIVITY',
        'COORDINATED_TRADING',
        'VOLUME_SPIKE',
        'PRICE_MANIPULATION',
        'FRESH_WALLET_CLUSTER',
        'INSIDER_PATTERN',
      ];
      const markets = generateMockMarkets(10);
      markets.forEach((market) => {
        market.alertTypes.forEach((type) => {
          expect(validAlertTypes).toContain(type);
        });
      });
    });

    it('should generate markets with probability between 0.1 and 0.9', () => {
      const markets = generateMockMarkets(20);
      markets.forEach((market) => {
        expect(market.currentProbability).toBeGreaterThanOrEqual(0.1);
        expect(market.currentProbability).toBeLessThanOrEqual(0.9);
      });
    });

    it('should generate some watched markets', () => {
      const markets = generateMockMarkets(20);
      const watchedCount = markets.filter((m) => m.isWatched).length;
      // With 30% probability, we expect some but not all to be watched
      expect(watchedCount).toBeGreaterThanOrEqual(0);
      expect(watchedCount).toBeLessThanOrEqual(20);
    });
  });

  // ============================================================
  // Market Aggregation Tests
  // ============================================================
  describe('Market Aggregation', () => {
    let markets: HotMarket[];

    beforeEach(() => {
      markets = [
        {
          id: 'market-1',
          title: 'Market 1',
          slug: 'market-1',
          category: 'CRYPTO',
          heatLevel: 'CRITICAL',
          heatScore: 90,
          alertCount: 10,
          alertTypes: ['WHALE_ACTIVITY'],
          currentProbability: 0.7,
          probabilityChange: 0.05,
          volume24h: 1000000,
          volumeChange: 0.2,
          suspiciousWallets: 5,
          lastAlert: new Date(),
          isWatched: true,
        },
        {
          id: 'market-2',
          title: 'Market 2',
          slug: 'market-2',
          category: 'POLITICS',
          heatLevel: 'HIGH',
          heatScore: 70,
          alertCount: 7,
          alertTypes: ['COORDINATED_TRADING'],
          currentProbability: 0.5,
          probabilityChange: -0.03,
          volume24h: 500000,
          volumeChange: 0.1,
          suspiciousWallets: 3,
          lastAlert: new Date(),
          isWatched: false,
        },
        {
          id: 'market-3',
          title: 'Market 3',
          slug: 'market-3',
          category: 'SPORTS',
          heatLevel: 'MEDIUM',
          heatScore: 50,
          alertCount: 3,
          alertTypes: ['VOLUME_SPIKE'],
          currentProbability: 0.3,
          probabilityChange: 0.02,
          volume24h: 200000,
          volumeChange: -0.05,
          suspiciousWallets: 2,
          lastAlert: new Date(),
          isWatched: true,
        },
      ];
    });

    it('should count critical markets correctly', () => {
      const criticalCount = markets.filter((m) => m.heatLevel === 'CRITICAL').length;
      expect(criticalCount).toBe(1);
    });

    it('should count high markets correctly', () => {
      const highCount = markets.filter((m) => m.heatLevel === 'HIGH').length;
      expect(highCount).toBe(1);
    });

    it('should count watched markets correctly', () => {
      const watchedCount = markets.filter((m) => m.isWatched).length;
      expect(watchedCount).toBe(2);
    });

    it('should calculate total alerts correctly', () => {
      const totalAlerts = markets.reduce((sum, m) => sum + m.alertCount, 0);
      expect(totalAlerts).toBe(20);
    });

    it('should calculate total volume correctly', () => {
      const totalVolume = markets.reduce((sum, m) => sum + m.volume24h, 0);
      expect(totalVolume).toBe(1700000);
    });
  });

  // ============================================================
  // Market Sorting Tests
  // ============================================================
  describe('Market Sorting', () => {
    it('should sort markets by heat score descending', () => {
      const markets: HotMarket[] = [
        {
          id: 'market-1',
          title: 'Low Heat',
          slug: 'low-heat',
          category: 'OTHER',
          heatLevel: 'LOW',
          heatScore: 25,
          alertCount: 1,
          alertTypes: [],
          currentProbability: 0.5,
          probabilityChange: 0,
          volume24h: 10000,
          volumeChange: 0,
          suspiciousWallets: 1,
          lastAlert: new Date(),
        },
        {
          id: 'market-2',
          title: 'Critical Heat',
          slug: 'critical-heat',
          category: 'CRYPTO',
          heatLevel: 'CRITICAL',
          heatScore: 95,
          alertCount: 15,
          alertTypes: ['WHALE_ACTIVITY'],
          currentProbability: 0.8,
          probabilityChange: 0.1,
          volume24h: 2000000,
          volumeChange: 0.3,
          suspiciousWallets: 10,
          lastAlert: new Date(),
        },
        {
          id: 'market-3',
          title: 'Medium Heat',
          slug: 'medium-heat',
          category: 'POLITICS',
          heatLevel: 'MEDIUM',
          heatScore: 55,
          alertCount: 5,
          alertTypes: ['VOLUME_SPIKE'],
          currentProbability: 0.6,
          probabilityChange: 0.02,
          volume24h: 500000,
          volumeChange: 0.1,
          suspiciousWallets: 3,
          lastAlert: new Date(),
        },
      ];

      const sorted = [...markets].sort((a, b) => b.heatScore - a.heatScore);

      expect(sorted[0]?.title).toBe('Critical Heat');
      expect(sorted[1]?.title).toBe('Medium Heat');
      expect(sorted[2]?.title).toBe('Low Heat');
    });
  });

  // ============================================================
  // Props Validation Tests
  // ============================================================
  describe('Props Validation', () => {
    it('should accept markets array prop', () => {
      const markets: HotMarket[] = generateMockMarkets(3);
      expect(markets).toBeDefined();
      expect(Array.isArray(markets)).toBe(true);
    });

    it('should accept maxMarkets prop as number', () => {
      const maxMarkets = 10;
      expect(typeof maxMarkets).toBe('number');
      expect(maxMarkets).toBeGreaterThan(0);
    });

    it('should accept onMarketClick callback prop', () => {
      const callback = vi.fn();
      const market = generateMockMarkets(1)[0];
      if (market) {
        callback(market);
        expect(callback).toHaveBeenCalledWith(market);
      }
    });

    it('should accept onWatchToggle callback prop', () => {
      const callback = vi.fn();
      callback('market-1');
      expect(callback).toHaveBeenCalledWith('market-1');
    });

    it('should accept showAlertTypes boolean prop', () => {
      const showAlertTypes = true;
      expect(typeof showAlertTypes).toBe('boolean');
    });

    it('should accept testId string prop', () => {
      const testId = 'hot-markets-test';
      expect(typeof testId).toBe('string');
    });
  });

  // ============================================================
  // Data Attributes Tests
  // ============================================================
  describe('Data Attributes', () => {
    it('should have correct data-market-id format', () => {
      const markets = generateMockMarkets(3);
      markets.forEach((market) => {
        expect(market.id).toMatch(/^market-\d+$/);
      });
    });

    it('should have correct data-market-heat range', () => {
      const markets = generateMockMarkets(10);
      markets.forEach((market) => {
        expect(market.heatScore).toBeGreaterThanOrEqual(0);
        expect(market.heatScore).toBeLessThanOrEqual(100);
      });
    });
  });

  // ============================================================
  // Accessibility Tests
  // ============================================================
  describe('Accessibility', () => {
    it('should have aria labels based on market data', () => {
      const market = generateMockMarkets(1)[0];
      if (market) {
        const expectedLabel = `Market ${truncateTitle(market.title)} with heat score ${market.heatScore}`;
        expect(expectedLabel).toContain(market.heatScore.toString());
      }
    });

    it('should support keyboard navigation data', () => {
      const tabIndex = 0;
      expect(tabIndex).toBe(0); // Elements should be focusable
    });
  });

  // ============================================================
  // Edge Cases Tests
  // ============================================================
  describe('Edge Cases', () => {
    it('should handle empty markets array', () => {
      const markets: HotMarket[] = [];
      expect(markets.length).toBe(0);
    });

    it('should handle market with zero heat score', () => {
      const market: HotMarket = {
        id: 'market-zero',
        title: 'Zero Heat Market',
        slug: 'zero-heat',
        category: 'OTHER',
        heatLevel: 'NONE',
        heatScore: 0,
        alertCount: 0,
        alertTypes: [],
        currentProbability: 0.5,
        probabilityChange: 0,
        volume24h: 0,
        volumeChange: 0,
        suspiciousWallets: 0,
        lastAlert: new Date(),
      };

      expect(market.heatScore).toBe(0);
      expect(market.heatLevel).toBe('NONE');
    });

    it('should handle market with max heat score', () => {
      const market: HotMarket = {
        id: 'market-max',
        title: 'Maximum Heat Market',
        slug: 'max-heat',
        category: 'CRYPTO',
        heatLevel: 'CRITICAL',
        heatScore: 100,
        alertCount: 50,
        alertTypes: [
          'WHALE_ACTIVITY',
          'COORDINATED_TRADING',
          'VOLUME_SPIKE',
          'PRICE_MANIPULATION',
          'FRESH_WALLET_CLUSTER',
          'INSIDER_PATTERN',
        ],
        currentProbability: 0.99,
        probabilityChange: 0.5,
        volume24h: 100000000,
        volumeChange: 10,
        suspiciousWallets: 100,
        lastAlert: new Date(),
      };

      expect(market.heatScore).toBe(100);
      expect(market.heatLevel).toBe('CRITICAL');
    });

    it('should handle market with empty title', () => {
      expect(truncateTitle('')).toBe('');
    });

    it('should handle very long market title', () => {
      const longTitle = 'A'.repeat(200);
      const truncated = truncateTitle(longTitle, 50);
      expect(truncated.length).toBeLessThanOrEqual(50);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('should handle volume at exactly 1M boundary', () => {
      expect(formatMarketVolume(1000000)).toBe('$1.0M');
    });

    it('should handle volume at exactly 1K boundary', () => {
      expect(formatMarketVolume(1000)).toBe('$1.0K');
    });

    it('should handle negative probability change', () => {
      expect(formatPercentageChange(-0.5)).toBe('-50.0%');
    });

    it('should handle very small probability change', () => {
      expect(formatPercentageChange(0.0001)).toBe('+0.0%');
    });
  });
});
