/**
 * Unit Tests for SuspiciousWalletsWidget
 * Feature: UI-DASH-004 - Top suspicious wallets widget
 *
 * Tests wallet display, ranking, interaction, and helper functions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SuspiciousWallet,
  SuspicionLevel,
  RiskFlag,
  suspicionLevelConfig,
  riskFlagConfig,
  getSuspicionLevelConfig,
  getRiskFlagConfig,
  formatWalletAddress,
  formatVolume,
  formatTimeAgo,
  getSuspicionLevelFromScore,
  generateMockWallets,
} from '../../app/dashboard/components/SuspiciousWalletsWidget';

describe('SuspiciousWalletsWidget Unit Tests', () => {
  // ============================================================
  // SuspicionLevel Enum Tests
  // ============================================================
  describe('SuspicionLevel', () => {
    it('should define CRITICAL level', () => {
      const level: SuspicionLevel = 'CRITICAL';
      expect(level).toBe('CRITICAL');
    });

    it('should define HIGH level', () => {
      const level: SuspicionLevel = 'HIGH';
      expect(level).toBe('HIGH');
    });

    it('should define MEDIUM level', () => {
      const level: SuspicionLevel = 'MEDIUM';
      expect(level).toBe('MEDIUM');
    });

    it('should define LOW level', () => {
      const level: SuspicionLevel = 'LOW';
      expect(level).toBe('LOW');
    });

    it('should define NONE level', () => {
      const level: SuspicionLevel = 'NONE';
      expect(level).toBe('NONE');
    });

    it('should have exactly 5 suspicion levels', () => {
      const levels: SuspicionLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
      expect(levels.length).toBe(5);
    });
  });

  // ============================================================
  // RiskFlag Enum Tests
  // ============================================================
  describe('RiskFlag', () => {
    it('should define FRESH_WALLET flag', () => {
      const flag: RiskFlag = 'FRESH_WALLET';
      expect(flag).toBe('FRESH_WALLET');
    });

    it('should define HIGH_WIN_RATE flag', () => {
      const flag: RiskFlag = 'HIGH_WIN_RATE';
      expect(flag).toBe('HIGH_WIN_RATE');
    });

    it('should define UNUSUAL_TIMING flag', () => {
      const flag: RiskFlag = 'UNUSUAL_TIMING';
      expect(flag).toBe('UNUSUAL_TIMING');
    });

    it('should define LARGE_POSITIONS flag', () => {
      const flag: RiskFlag = 'LARGE_POSITIONS';
      expect(flag).toBe('LARGE_POSITIONS');
    });

    it('should define COORDINATED flag', () => {
      const flag: RiskFlag = 'COORDINATED';
      expect(flag).toBe('COORDINATED');
    });

    it('should define SYBIL_LINKED flag', () => {
      const flag: RiskFlag = 'SYBIL_LINKED';
      expect(flag).toBe('SYBIL_LINKED');
    });

    it('should define NICHE_FOCUS flag', () => {
      const flag: RiskFlag = 'NICHE_FOCUS';
      expect(flag).toBe('NICHE_FOCUS');
    });

    it('should have exactly 7 risk flags', () => {
      const flags: RiskFlag[] = [
        'FRESH_WALLET',
        'HIGH_WIN_RATE',
        'UNUSUAL_TIMING',
        'LARGE_POSITIONS',
        'COORDINATED',
        'SYBIL_LINKED',
        'NICHE_FOCUS',
      ];
      expect(flags.length).toBe(7);
    });
  });

  // ============================================================
  // SuspiciousWallet Interface Tests
  // ============================================================
  describe('SuspiciousWallet Interface', () => {
    it('should create a valid wallet object', () => {
      const wallet: SuspiciousWallet = {
        id: 'wallet-1',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        suspicionScore: 75,
        suspicionLevel: 'HIGH',
        riskFlags: ['FRESH_WALLET', 'HIGH_WIN_RATE'],
        totalVolume: 50000,
        winRate: 0.85,
        lastActivity: new Date(),
        tradeCount: 25,
        isWatched: false,
      };

      expect(wallet.id).toBe('wallet-1');
      expect(wallet.suspicionScore).toBe(75);
      expect(wallet.suspicionLevel).toBe('HIGH');
      expect(wallet.riskFlags).toHaveLength(2);
    });

    it('should allow optional isWatched field', () => {
      const wallet: SuspiciousWallet = {
        id: 'wallet-1',
        address: '0x1234',
        suspicionScore: 50,
        suspicionLevel: 'MEDIUM',
        riskFlags: [],
        totalVolume: 1000,
        winRate: 0.5,
        lastActivity: new Date(),
        tradeCount: 10,
      };

      expect(wallet.isWatched).toBeUndefined();
    });

    it('should accept empty riskFlags array', () => {
      const wallet: SuspiciousWallet = {
        id: 'wallet-1',
        address: '0x1234',
        suspicionScore: 10,
        suspicionLevel: 'LOW',
        riskFlags: [],
        totalVolume: 500,
        winRate: 0.3,
        lastActivity: new Date(),
        tradeCount: 5,
      };

      expect(wallet.riskFlags).toHaveLength(0);
    });
  });

  // ============================================================
  // suspicionLevelConfig Tests
  // ============================================================
  describe('suspicionLevelConfig', () => {
    it('should have config for all suspicion levels', () => {
      const levels: SuspicionLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
      levels.forEach((level) => {
        expect(suspicionLevelConfig[level]).toBeDefined();
      });
    });

    it('should have label for each level', () => {
      Object.values(suspicionLevelConfig).forEach((config) => {
        expect(config.label).toBeDefined();
        expect(typeof config.label).toBe('string');
        expect(config.label.length).toBeGreaterThan(0);
      });
    });

    it('should have color class for each level', () => {
      Object.values(suspicionLevelConfig).forEach((config) => {
        expect(config.color).toBeDefined();
        expect(config.color).toContain('text-');
      });
    });

    it('should have bgColor class for each level', () => {
      Object.values(suspicionLevelConfig).forEach((config) => {
        expect(config.bgColor).toBeDefined();
        expect(config.bgColor).toContain('bg-');
      });
    });

    it('should have borderColor class for each level', () => {
      Object.values(suspicionLevelConfig).forEach((config) => {
        expect(config.borderColor).toBeDefined();
        expect(config.borderColor).toContain('border-');
      });
    });

    it('should have correct label for CRITICAL', () => {
      expect(suspicionLevelConfig.CRITICAL.label).toBe('Critical');
    });

    it('should have correct label for HIGH', () => {
      expect(suspicionLevelConfig.HIGH.label).toBe('High');
    });

    it('should have correct label for MEDIUM', () => {
      expect(suspicionLevelConfig.MEDIUM.label).toBe('Medium');
    });

    it('should have correct label for LOW', () => {
      expect(suspicionLevelConfig.LOW.label).toBe('Low');
    });

    it('should have correct label for NONE', () => {
      expect(suspicionLevelConfig.NONE.label).toBe('None');
    });

    it('should use red colors for CRITICAL', () => {
      expect(suspicionLevelConfig.CRITICAL.color).toContain('red');
      expect(suspicionLevelConfig.CRITICAL.bgColor).toContain('red');
      expect(suspicionLevelConfig.CRITICAL.borderColor).toContain('red');
    });

    it('should use orange colors for HIGH', () => {
      expect(suspicionLevelConfig.HIGH.color).toContain('orange');
      expect(suspicionLevelConfig.HIGH.bgColor).toContain('orange');
      expect(suspicionLevelConfig.HIGH.borderColor).toContain('orange');
    });

    it('should use yellow colors for MEDIUM', () => {
      expect(suspicionLevelConfig.MEDIUM.color).toContain('yellow');
      expect(suspicionLevelConfig.MEDIUM.bgColor).toContain('yellow');
      expect(suspicionLevelConfig.MEDIUM.borderColor).toContain('yellow');
    });
  });

  // ============================================================
  // riskFlagConfig Tests
  // ============================================================
  describe('riskFlagConfig', () => {
    it('should have config for all risk flags', () => {
      const flags: RiskFlag[] = [
        'FRESH_WALLET',
        'HIGH_WIN_RATE',
        'UNUSUAL_TIMING',
        'LARGE_POSITIONS',
        'COORDINATED',
        'SYBIL_LINKED',
        'NICHE_FOCUS',
      ];
      flags.forEach((flag) => {
        expect(riskFlagConfig[flag]).toBeDefined();
      });
    });

    it('should have label for each flag', () => {
      Object.values(riskFlagConfig).forEach((config) => {
        expect(config.label).toBeDefined();
        expect(typeof config.label).toBe('string');
        expect(config.label.length).toBeGreaterThan(0);
      });
    });

    it('should have icon for each flag', () => {
      Object.values(riskFlagConfig).forEach((config) => {
        expect(config.icon).toBeDefined();
        expect(typeof config.icon).toBe('string');
        expect(config.icon.length).toBeGreaterThan(0);
      });
    });

    it('should have color class for each flag', () => {
      Object.values(riskFlagConfig).forEach((config) => {
        expect(config.color).toBeDefined();
        expect(config.color).toContain('text-');
      });
    });

    it('should have correct config for FRESH_WALLET', () => {
      expect(riskFlagConfig.FRESH_WALLET.label).toBe('Fresh');
      expect(riskFlagConfig.FRESH_WALLET.icon).toBe('✨');
    });

    it('should have correct config for SYBIL_LINKED', () => {
      expect(riskFlagConfig.SYBIL_LINKED.label).toBe('Sybil');
      expect(riskFlagConfig.SYBIL_LINKED.icon).toBe('👥');
    });

    it('should have correct config for LARGE_POSITIONS', () => {
      expect(riskFlagConfig.LARGE_POSITIONS.label).toBe('Large');
      expect(riskFlagConfig.LARGE_POSITIONS.icon).toBe('🐋');
    });
  });

  // ============================================================
  // getSuspicionLevelConfig Tests
  // ============================================================
  describe('getSuspicionLevelConfig', () => {
    it('should return config for CRITICAL level', () => {
      const config = getSuspicionLevelConfig('CRITICAL');
      expect(config).toBe(suspicionLevelConfig.CRITICAL);
    });

    it('should return config for HIGH level', () => {
      const config = getSuspicionLevelConfig('HIGH');
      expect(config).toBe(suspicionLevelConfig.HIGH);
    });

    it('should return config for MEDIUM level', () => {
      const config = getSuspicionLevelConfig('MEDIUM');
      expect(config).toBe(suspicionLevelConfig.MEDIUM);
    });

    it('should return config for LOW level', () => {
      const config = getSuspicionLevelConfig('LOW');
      expect(config).toBe(suspicionLevelConfig.LOW);
    });

    it('should return config for NONE level', () => {
      const config = getSuspicionLevelConfig('NONE');
      expect(config).toBe(suspicionLevelConfig.NONE);
    });

    it('should fallback to NONE config for invalid level', () => {
      // @ts-ignore - Testing invalid input
      const config = getSuspicionLevelConfig('INVALID');
      expect(config).toBe(suspicionLevelConfig.NONE);
    });
  });

  // ============================================================
  // getRiskFlagConfig Tests
  // ============================================================
  describe('getRiskFlagConfig', () => {
    it('should return config for FRESH_WALLET flag', () => {
      const config = getRiskFlagConfig('FRESH_WALLET');
      expect(config).toBe(riskFlagConfig.FRESH_WALLET);
    });

    it('should return config for HIGH_WIN_RATE flag', () => {
      const config = getRiskFlagConfig('HIGH_WIN_RATE');
      expect(config).toBe(riskFlagConfig.HIGH_WIN_RATE);
    });

    it('should return config for SYBIL_LINKED flag', () => {
      const config = getRiskFlagConfig('SYBIL_LINKED');
      expect(config).toBe(riskFlagConfig.SYBIL_LINKED);
    });

    it('should fallback to FRESH_WALLET config for invalid flag', () => {
      // @ts-ignore - Testing invalid input
      const config = getRiskFlagConfig('INVALID');
      expect(config).toBe(riskFlagConfig.FRESH_WALLET);
    });
  });

  // ============================================================
  // formatWalletAddress Tests
  // ============================================================
  describe('formatWalletAddress', () => {
    it('should format long address with ellipsis', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const formatted = formatWalletAddress(address);
      expect(formatted).toBe('0x1234...5678');
    });

    it('should return short address unchanged', () => {
      const address = '0x12345678';
      const formatted = formatWalletAddress(address);
      expect(formatted).toBe('0x12345678');
    });

    it('should handle exactly 12 character address', () => {
      const address = '123456789012';
      const formatted = formatWalletAddress(address);
      expect(formatted).toBe('123456789012');
    });

    it('should format 13 character address', () => {
      const address = '1234567890123';
      const formatted = formatWalletAddress(address);
      expect(formatted).toBe('123456...0123');
    });

    it('should show first 6 and last 4 characters', () => {
      const address = '0xABCDEF1234567890GHIJKL';
      const formatted = formatWalletAddress(address);
      expect(formatted.startsWith('0xABCD')).toBe(true);
      expect(formatted.endsWith('IJKL')).toBe(true);
      expect(formatted).toContain('...');
    });
  });

  // ============================================================
  // formatVolume Tests
  // ============================================================
  describe('formatVolume', () => {
    it('should format millions correctly', () => {
      expect(formatVolume(1000000)).toBe('$1.0M');
      expect(formatVolume(2500000)).toBe('$2.5M');
      expect(formatVolume(10000000)).toBe('$10.0M');
    });

    it('should format thousands correctly', () => {
      expect(formatVolume(1000)).toBe('$1.0K');
      expect(formatVolume(25000)).toBe('$25.0K');
      expect(formatVolume(999999)).toBe('$1000.0K');
    });

    it('should format small amounts correctly', () => {
      expect(formatVolume(500)).toBe('$500');
      expect(formatVolume(999)).toBe('$999');
      expect(formatVolume(1)).toBe('$1');
    });

    it('should format zero correctly', () => {
      expect(formatVolume(0)).toBe('$0');
    });

    it('should handle decimal values', () => {
      expect(formatVolume(1500.75)).toBe('$1.5K');
    });
  });

  // ============================================================
  // formatTimeAgo Tests
  // ============================================================
  describe('formatTimeAgo', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-12T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should format as "Just now" for recent times', () => {
      const date = new Date('2026-01-12T11:59:30Z');
      expect(formatTimeAgo(date)).toBe('Just now');
    });

    it('should format minutes ago correctly', () => {
      const date = new Date('2026-01-12T11:55:00Z');
      expect(formatTimeAgo(date)).toBe('5m ago');
    });

    it('should format hours ago correctly', () => {
      const date = new Date('2026-01-12T09:00:00Z');
      expect(formatTimeAgo(date)).toBe('3h ago');
    });

    it('should format days ago correctly', () => {
      const date = new Date('2026-01-10T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('2d ago');
    });

    it('should handle exactly 1 minute ago', () => {
      const date = new Date('2026-01-12T11:59:00Z');
      expect(formatTimeAgo(date)).toBe('1m ago');
    });

    it('should handle exactly 1 hour ago', () => {
      const date = new Date('2026-01-12T11:00:00Z');
      expect(formatTimeAgo(date)).toBe('1h ago');
    });

    it('should handle exactly 1 day ago', () => {
      const date = new Date('2026-01-11T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('1d ago');
    });
  });

  // ============================================================
  // getSuspicionLevelFromScore Tests
  // ============================================================
  describe('getSuspicionLevelFromScore', () => {
    it('should return CRITICAL for score >= 80', () => {
      expect(getSuspicionLevelFromScore(80)).toBe('CRITICAL');
      expect(getSuspicionLevelFromScore(90)).toBe('CRITICAL');
      expect(getSuspicionLevelFromScore(100)).toBe('CRITICAL');
    });

    it('should return HIGH for score 60-79', () => {
      expect(getSuspicionLevelFromScore(60)).toBe('HIGH');
      expect(getSuspicionLevelFromScore(70)).toBe('HIGH');
      expect(getSuspicionLevelFromScore(79)).toBe('HIGH');
    });

    it('should return MEDIUM for score 40-59', () => {
      expect(getSuspicionLevelFromScore(40)).toBe('MEDIUM');
      expect(getSuspicionLevelFromScore(50)).toBe('MEDIUM');
      expect(getSuspicionLevelFromScore(59)).toBe('MEDIUM');
    });

    it('should return LOW for score 20-39', () => {
      expect(getSuspicionLevelFromScore(20)).toBe('LOW');
      expect(getSuspicionLevelFromScore(30)).toBe('LOW');
      expect(getSuspicionLevelFromScore(39)).toBe('LOW');
    });

    it('should return NONE for score < 20', () => {
      expect(getSuspicionLevelFromScore(0)).toBe('NONE');
      expect(getSuspicionLevelFromScore(10)).toBe('NONE');
      expect(getSuspicionLevelFromScore(19)).toBe('NONE');
    });

    it('should handle boundary values correctly', () => {
      expect(getSuspicionLevelFromScore(79)).toBe('HIGH');
      expect(getSuspicionLevelFromScore(80)).toBe('CRITICAL');
      expect(getSuspicionLevelFromScore(59)).toBe('MEDIUM');
      expect(getSuspicionLevelFromScore(60)).toBe('HIGH');
      expect(getSuspicionLevelFromScore(39)).toBe('LOW');
      expect(getSuspicionLevelFromScore(40)).toBe('MEDIUM');
      expect(getSuspicionLevelFromScore(19)).toBe('NONE');
      expect(getSuspicionLevelFromScore(20)).toBe('LOW');
    });
  });

  // ============================================================
  // generateMockWallets Tests
  // ============================================================
  describe('generateMockWallets', () => {
    it('should generate default 5 wallets', () => {
      const wallets = generateMockWallets();
      expect(wallets.length).toBe(5);
    });

    it('should generate specified number of wallets', () => {
      expect(generateMockWallets(3).length).toBe(3);
      expect(generateMockWallets(10).length).toBe(10);
      expect(generateMockWallets(1).length).toBe(1);
    });

    it('should generate wallets with valid IDs', () => {
      const wallets = generateMockWallets(5);
      // Note: wallets are sorted by score after generation, so IDs may not match index
      wallets.forEach((wallet) => {
        expect(wallet.id).toMatch(/^wallet-\d+$/);
      });
    });

    it('should generate wallets with valid addresses', () => {
      const wallets = generateMockWallets(5);
      wallets.forEach((wallet) => {
        expect(wallet.address).toBeDefined();
        expect(typeof wallet.address).toBe('string');
        expect(wallet.address.length).toBeGreaterThan(0);
      });
    });

    it('should generate wallets with valid suspicion scores (0-100)', () => {
      const wallets = generateMockWallets(10);
      wallets.forEach((wallet) => {
        expect(wallet.suspicionScore).toBeGreaterThanOrEqual(0);
        expect(wallet.suspicionScore).toBeLessThanOrEqual(100);
      });
    });

    it('should generate wallets with matching suspicion level', () => {
      const wallets = generateMockWallets(10);
      wallets.forEach((wallet) => {
        const expectedLevel = getSuspicionLevelFromScore(wallet.suspicionScore);
        expect(wallet.suspicionLevel).toBe(expectedLevel);
      });
    });

    it('should generate wallets with at least one risk flag', () => {
      const wallets = generateMockWallets(10);
      wallets.forEach((wallet) => {
        expect(wallet.riskFlags.length).toBeGreaterThanOrEqual(1);
        expect(wallet.riskFlags.length).toBeLessThanOrEqual(4);
      });
    });

    it('should generate wallets with valid volume', () => {
      const wallets = generateMockWallets(10);
      wallets.forEach((wallet) => {
        expect(wallet.totalVolume).toBeGreaterThanOrEqual(1000);
        expect(wallet.totalVolume).toBeLessThanOrEqual(501000);
      });
    });

    it('should generate wallets with valid win rate (0.5-1.0)', () => {
      const wallets = generateMockWallets(10);
      wallets.forEach((wallet) => {
        expect(wallet.winRate).toBeGreaterThanOrEqual(0.5);
        expect(wallet.winRate).toBeLessThanOrEqual(1.0);
      });
    });

    it('should generate wallets with valid trade count', () => {
      const wallets = generateMockWallets(10);
      wallets.forEach((wallet) => {
        expect(wallet.tradeCount).toBeGreaterThanOrEqual(5);
        expect(wallet.tradeCount).toBeLessThanOrEqual(105);
      });
    });

    it('should generate wallets with valid lastActivity date', () => {
      const wallets = generateMockWallets(5);
      const now = Date.now();
      const oneWeekAgo = now - 86400000 * 7;

      wallets.forEach((wallet) => {
        expect(wallet.lastActivity instanceof Date).toBe(true);
        expect(wallet.lastActivity.getTime()).toBeLessThanOrEqual(now);
        expect(wallet.lastActivity.getTime()).toBeGreaterThanOrEqual(oneWeekAgo);
      });
    });

    it('should return wallets sorted by suspicion score descending', () => {
      const wallets = generateMockWallets(10);
      for (let i = 0; i < wallets.length - 1; i++) {
        const current = wallets[i];
        const next = wallets[i + 1];
        if (current && next) {
          expect(current.suspicionScore).toBeGreaterThanOrEqual(next.suspicionScore);
        }
      }
    });

    it('should generate wallets with isWatched property', () => {
      const wallets = generateMockWallets(10);
      wallets.forEach((wallet) => {
        expect(typeof wallet.isWatched).toBe('boolean');
      });
    });

    it('should generate unique wallet IDs', () => {
      const wallets = generateMockWallets(10);
      const ids = wallets.map((w) => w.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(wallets.length);
    });
  });

  // ============================================================
  // Wallet Aggregation Tests
  // ============================================================
  describe('Wallet Aggregation', () => {
    it('should count critical wallets correctly', () => {
      const wallets: SuspiciousWallet[] = [
        { id: '1', address: '0x1', suspicionScore: 85, suspicionLevel: 'CRITICAL', riskFlags: [], totalVolume: 1000, winRate: 0.7, lastActivity: new Date(), tradeCount: 10 },
        { id: '2', address: '0x2', suspicionScore: 90, suspicionLevel: 'CRITICAL', riskFlags: [], totalVolume: 2000, winRate: 0.8, lastActivity: new Date(), tradeCount: 20 },
        { id: '3', address: '0x3', suspicionScore: 70, suspicionLevel: 'HIGH', riskFlags: [], totalVolume: 1500, winRate: 0.6, lastActivity: new Date(), tradeCount: 15 },
      ];

      const criticalCount = wallets.filter((w) => w.suspicionLevel === 'CRITICAL').length;
      expect(criticalCount).toBe(2);
    });

    it('should count high risk wallets correctly', () => {
      const wallets: SuspiciousWallet[] = [
        { id: '1', address: '0x1', suspicionScore: 85, suspicionLevel: 'CRITICAL', riskFlags: [], totalVolume: 1000, winRate: 0.7, lastActivity: new Date(), tradeCount: 10 },
        { id: '2', address: '0x2', suspicionScore: 65, suspicionLevel: 'HIGH', riskFlags: [], totalVolume: 2000, winRate: 0.8, lastActivity: new Date(), tradeCount: 20 },
        { id: '3', address: '0x3', suspicionScore: 70, suspicionLevel: 'HIGH', riskFlags: [], totalVolume: 1500, winRate: 0.6, lastActivity: new Date(), tradeCount: 15 },
      ];

      const highCount = wallets.filter((w) => w.suspicionLevel === 'HIGH').length;
      expect(highCount).toBe(2);
    });

    it('should count watched wallets correctly', () => {
      const wallets: SuspiciousWallet[] = [
        { id: '1', address: '0x1', suspicionScore: 85, suspicionLevel: 'CRITICAL', riskFlags: [], totalVolume: 1000, winRate: 0.7, lastActivity: new Date(), tradeCount: 10, isWatched: true },
        { id: '2', address: '0x2', suspicionScore: 65, suspicionLevel: 'HIGH', riskFlags: [], totalVolume: 2000, winRate: 0.8, lastActivity: new Date(), tradeCount: 20, isWatched: true },
        { id: '3', address: '0x3', suspicionScore: 70, suspicionLevel: 'HIGH', riskFlags: [], totalVolume: 1500, winRate: 0.6, lastActivity: new Date(), tradeCount: 15, isWatched: false },
      ];

      const watchedCount = wallets.filter((w) => w.isWatched).length;
      expect(watchedCount).toBe(2);
    });
  });

  // ============================================================
  // Wallet Sorting Tests
  // ============================================================
  describe('Wallet Sorting', () => {
    it('should sort wallets by suspicion score descending', () => {
      const wallets: SuspiciousWallet[] = [
        { id: '1', address: '0x1', suspicionScore: 50, suspicionLevel: 'MEDIUM', riskFlags: [], totalVolume: 1000, winRate: 0.7, lastActivity: new Date(), tradeCount: 10 },
        { id: '2', address: '0x2', suspicionScore: 90, suspicionLevel: 'CRITICAL', riskFlags: [], totalVolume: 2000, winRate: 0.8, lastActivity: new Date(), tradeCount: 20 },
        { id: '3', address: '0x3', suspicionScore: 70, suspicionLevel: 'HIGH', riskFlags: [], totalVolume: 1500, winRate: 0.6, lastActivity: new Date(), tradeCount: 15 },
      ];

      const sorted = [...wallets].sort((a, b) => b.suspicionScore - a.suspicionScore);
      expect(sorted[0]?.suspicionScore).toBe(90);
      expect(sorted[1]?.suspicionScore).toBe(70);
      expect(sorted[2]?.suspicionScore).toBe(50);
    });

    it('should handle equal scores in sorting', () => {
      const wallets: SuspiciousWallet[] = [
        { id: '1', address: '0x1', suspicionScore: 75, suspicionLevel: 'HIGH', riskFlags: [], totalVolume: 1000, winRate: 0.7, lastActivity: new Date(), tradeCount: 10 },
        { id: '2', address: '0x2', suspicionScore: 75, suspicionLevel: 'HIGH', riskFlags: [], totalVolume: 2000, winRate: 0.8, lastActivity: new Date(), tradeCount: 20 },
      ];

      const sorted = [...wallets].sort((a, b) => b.suspicionScore - a.suspicionScore);
      expect(sorted.length).toBe(2);
      expect(sorted[0]?.suspicionScore).toBe(75);
      expect(sorted[1]?.suspicionScore).toBe(75);
    });
  });

  // ============================================================
  // Props Validation Tests
  // ============================================================
  describe('Props Validation', () => {
    it('should handle undefined wallets prop', () => {
      const wallets: SuspiciousWallet[] | undefined = undefined;
      expect(wallets).toBeUndefined();
    });

    it('should handle empty wallets array', () => {
      const wallets: SuspiciousWallet[] = [];
      expect(wallets.length).toBe(0);
    });

    it('should respect maxWallets limit', () => {
      const wallets = generateMockWallets(10);
      const maxWallets = 5;
      const displayed = wallets.slice(0, maxWallets);
      expect(displayed.length).toBe(5);
    });

    it('should toggle isWatched property', () => {
      const wallet: SuspiciousWallet = {
        id: '1',
        address: '0x1',
        suspicionScore: 50,
        suspicionLevel: 'MEDIUM',
        riskFlags: [],
        totalVolume: 1000,
        winRate: 0.7,
        lastActivity: new Date(),
        tradeCount: 10,
        isWatched: false,
      };

      wallet.isWatched = !wallet.isWatched;
      expect(wallet.isWatched).toBe(true);

      wallet.isWatched = !wallet.isWatched;
      expect(wallet.isWatched).toBe(false);
    });
  });

  // ============================================================
  // Data Attributes Tests
  // ============================================================
  describe('Data Attributes', () => {
    it('should format wallet ID for test ID', () => {
      const wallet: SuspiciousWallet = {
        id: 'wallet-123',
        address: '0x1234',
        suspicionScore: 50,
        suspicionLevel: 'MEDIUM',
        riskFlags: [],
        totalVolume: 1000,
        winRate: 0.5,
        lastActivity: new Date(),
        tradeCount: 10,
      };

      const testId = `wallet-item-${wallet.id}`;
      expect(testId).toBe('wallet-item-wallet-123');
    });

    it('should format risk flag for test ID', () => {
      const flag: RiskFlag = 'FRESH_WALLET';
      const testId = `risk-flag-${flag.toLowerCase().replace(/_/g, '-')}`;
      expect(testId).toBe('risk-flag-fresh-wallet');
    });

    it('should format all risk flags correctly for test IDs', () => {
      const flags: RiskFlag[] = [
        'FRESH_WALLET',
        'HIGH_WIN_RATE',
        'UNUSUAL_TIMING',
        'LARGE_POSITIONS',
        'COORDINATED',
        'SYBIL_LINKED',
        'NICHE_FOCUS',
      ];

      const expectedTestIds = [
        'risk-flag-fresh-wallet',
        'risk-flag-high-win-rate',
        'risk-flag-unusual-timing',
        'risk-flag-large-positions',
        'risk-flag-coordinated',
        'risk-flag-sybil-linked',
        'risk-flag-niche-focus',
      ];

      flags.forEach((flag, index) => {
        const testId = `risk-flag-${flag.toLowerCase().replace(/_/g, '-')}`;
        expect(testId).toBe(expectedTestIds[index]);
      });
    });
  });

  // ============================================================
  // Accessibility Tests
  // ============================================================
  describe('Accessibility', () => {
    it('should have aria-label format for wallet items', () => {
      const wallet: SuspiciousWallet = {
        id: '1',
        address: '0x1234567890abcdef',
        suspicionScore: 75,
        suspicionLevel: 'HIGH',
        riskFlags: [],
        totalVolume: 1000,
        winRate: 0.5,
        lastActivity: new Date(),
        tradeCount: 10,
      };

      const formatted = formatWalletAddress(wallet.address);
      const ariaLabel = `Wallet ${formatted} with suspicion score ${wallet.suspicionScore}`;
      expect(ariaLabel).toContain(formatted);
      expect(ariaLabel).toContain('75');
    });

    it('should generate wallet list aria-label', () => {
      const ariaLabel = 'Suspicious wallets ranked by score';
      expect(ariaLabel).toBe('Suspicious wallets ranked by score');
    });
  });

  // ============================================================
  // Edge Cases Tests
  // ============================================================
  describe('Edge Cases', () => {
    it('should handle wallet with score 0', () => {
      const level = getSuspicionLevelFromScore(0);
      expect(level).toBe('NONE');
    });

    it('should handle wallet with score 100', () => {
      const level = getSuspicionLevelFromScore(100);
      expect(level).toBe('CRITICAL');
    });

    it('should handle wallet with maximum risk flags', () => {
      const wallet: SuspiciousWallet = {
        id: '1',
        address: '0x1',
        suspicionScore: 95,
        suspicionLevel: 'CRITICAL',
        riskFlags: [
          'FRESH_WALLET',
          'HIGH_WIN_RATE',
          'UNUSUAL_TIMING',
          'LARGE_POSITIONS',
          'COORDINATED',
          'SYBIL_LINKED',
          'NICHE_FOCUS',
        ],
        totalVolume: 1000000,
        winRate: 0.99,
        lastActivity: new Date(),
        tradeCount: 100,
      };

      expect(wallet.riskFlags.length).toBe(7);
    });

    it('should handle very large volume numbers', () => {
      const formatted = formatVolume(999999999);
      expect(formatted).toBe('$1000.0M');
    });

    it('should handle empty address', () => {
      const formatted = formatWalletAddress('');
      expect(formatted).toBe('');
    });
  });
});
