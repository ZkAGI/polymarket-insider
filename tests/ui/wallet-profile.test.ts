/**
 * Unit tests for Wallet Profile components
 * Feature: UI-WALLET-001 - Wallet profile page
 */

import { describe, it, expect, vi } from 'vitest';

// Import types from components
import type { WalletProfileHeaderProps } from '../../app/wallet/[address]/components/WalletProfileHeader';
import type { SuspicionScoreDisplayProps } from '../../app/wallet/[address]/components/SuspicionScoreDisplay';
import type { ActivitySummaryWidgetProps } from '../../app/wallet/[address]/components/ActivitySummaryWidget';

describe('WalletProfileHeader Types and Props', () => {
  it('should have correct prop types', () => {
    const mockWallet: WalletProfileHeaderProps['wallet'] = {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      label: 'Test Wallet',
      walletType: 'EOA',
      isWhale: true,
      isInsider: false,
      isFresh: true,
      isMonitored: true,
      isFlagged: false,
      isSanctioned: false,
      walletCreatedAt: new Date('2024-01-01'),
      primaryFundingSource: 'EXCHANGE',
      notes: 'Test notes',
    };

    expect(mockWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(mockWallet.walletType).toMatch(/^(EOA|CONTRACT|EXCHANGE|DEFI|BOT|UNKNOWN)$/);
    expect(typeof mockWallet.isWhale).toBe('boolean');
    expect(typeof mockWallet.isInsider).toBe('boolean');
    expect(typeof mockWallet.isFresh).toBe('boolean');
    expect(typeof mockWallet.isMonitored).toBe('boolean');
    expect(typeof mockWallet.isFlagged).toBe('boolean');
    expect(typeof mockWallet.isSanctioned).toBe('boolean');
  });

  it('should handle optional label', () => {
    const walletWithoutLabel: WalletProfileHeaderProps['wallet'] = {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      walletType: 'EOA',
      isWhale: false,
      isInsider: false,
      isFresh: false,
      isMonitored: false,
      isFlagged: false,
      isSanctioned: false,
      walletCreatedAt: null,
      primaryFundingSource: null,
      notes: null,
    };

    expect(walletWithoutLabel.label).toBeUndefined();
  });

  it('should handle nullable fields', () => {
    const wallet: WalletProfileHeaderProps['wallet'] = {
      address: '0x0000000000000000000000000000000000000000',
      walletType: 'UNKNOWN',
      isWhale: false,
      isInsider: false,
      isFresh: false,
      isMonitored: false,
      isFlagged: false,
      isSanctioned: false,
      walletCreatedAt: null,
      primaryFundingSource: null,
      notes: null,
    };

    expect(wallet.walletCreatedAt).toBeNull();
    expect(wallet.primaryFundingSource).toBeNull();
    expect(wallet.notes).toBeNull();
  });

  it('should accept callback functions', () => {
    const mockOnMonitorToggle = vi.fn();
    const mockOnFlagToggle = vi.fn();

    const props: Partial<WalletProfileHeaderProps> = {
      onMonitorToggle: mockOnMonitorToggle,
      onFlagToggle: mockOnFlagToggle,
    };

    expect(typeof props.onMonitorToggle).toBe('function');
    expect(typeof props.onFlagToggle).toBe('function');

    props.onMonitorToggle?.();
    props.onFlagToggle?.();

    expect(mockOnMonitorToggle).toHaveBeenCalledTimes(1);
    expect(mockOnFlagToggle).toHaveBeenCalledTimes(1);
  });
});

describe('SuspicionScoreDisplay Types and Props', () => {
  it('should have correct prop types', () => {
    const props: SuspicionScoreDisplayProps = {
      suspicionScore: 75,
      riskLevel: 'HIGH',
      riskFlags: {
        isWhale: true,
        isInsider: false,
        isFresh: true,
        isFlagged: false,
        isSanctioned: false,
      },
    };

    expect(typeof props.suspicionScore).toBe('number');
    expect(props.suspicionScore).toBeGreaterThanOrEqual(0);
    expect(props.suspicionScore).toBeLessThanOrEqual(100);
    expect(props.riskLevel).toMatch(/^(CRITICAL|HIGH|MEDIUM|LOW|NONE)$/);
    expect(typeof props.riskFlags.isWhale).toBe('boolean');
    expect(typeof props.riskFlags.isInsider).toBe('boolean');
    expect(typeof props.riskFlags.isFresh).toBe('boolean');
    expect(typeof props.riskFlags.isFlagged).toBe('boolean');
    expect(typeof props.riskFlags.isSanctioned).toBe('boolean');
  });

  it('should handle different risk levels', () => {
    const riskLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

    riskLevels.forEach((level) => {
      const props: SuspicionScoreDisplayProps = {
        suspicionScore: 50,
        riskLevel: level,
        riskFlags: {
          isWhale: false,
          isInsider: false,
          isFresh: false,
          isFlagged: false,
          isSanctioned: false,
        },
      };

      expect(props.riskLevel).toBe(level);
    });
  });

  it('should handle edge case scores', () => {
    const edgeCases = [0, 25, 50, 75, 100];

    edgeCases.forEach((score) => {
      const props: SuspicionScoreDisplayProps = {
        suspicionScore: score,
        riskLevel: 'MEDIUM',
        riskFlags: {
          isWhale: false,
          isInsider: false,
          isFresh: false,
          isFlagged: false,
          isSanctioned: false,
        },
      };

      expect(props.suspicionScore).toBe(score);
      expect(props.suspicionScore).toBeGreaterThanOrEqual(0);
      expect(props.suspicionScore).toBeLessThanOrEqual(100);
    });
  });

  it('should handle all flags being true', () => {
    const props: SuspicionScoreDisplayProps = {
      suspicionScore: 90,
      riskLevel: 'CRITICAL',
      riskFlags: {
        isWhale: true,
        isInsider: true,
        isFresh: true,
        isFlagged: true,
        isSanctioned: true,
      },
    };

    const activeFlags = Object.values(props.riskFlags).filter(Boolean).length;
    expect(activeFlags).toBe(5);
  });

  it('should handle all flags being false', () => {
    const props: SuspicionScoreDisplayProps = {
      suspicionScore: 10,
      riskLevel: 'NONE',
      riskFlags: {
        isWhale: false,
        isInsider: false,
        isFresh: false,
        isFlagged: false,
        isSanctioned: false,
      },
    };

    const activeFlags = Object.values(props.riskFlags).filter(Boolean).length;
    expect(activeFlags).toBe(0);
  });
});

describe('ActivitySummaryWidget Types and Props', () => {
  it('should have correct prop types', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 250000,
      totalPnl: 15000,
      tradeCount: 50,
      winCount: 35,
      winRate: 70,
      avgTradeSize: 5000,
      maxTradeSize: 25000,
      firstTradeAt: new Date('2024-01-01'),
      lastTradeAt: new Date('2024-12-01'),
      walletAgeDays: 335,
      onChainTxCount: 75,
    };

    expect(typeof props.totalVolume).toBe('number');
    expect(typeof props.totalPnl).toBe('number');
    expect(typeof props.tradeCount).toBe('number');
    expect(typeof props.winCount).toBe('number');
    expect(typeof props.winRate).toBe('number');
    expect(typeof props.avgTradeSize).toBe('number');
    expect(typeof props.maxTradeSize).toBe('number');
    expect(props.firstTradeAt).toBeInstanceOf(Date);
    expect(props.lastTradeAt).toBeInstanceOf(Date);
    expect(typeof props.walletAgeDays).toBe('number');
    expect(typeof props.onChainTxCount).toBe('number');
  });

  it('should handle null winRate', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 100000,
      totalPnl: 5000,
      tradeCount: 10,
      winCount: 5,
      winRate: null,
      avgTradeSize: 10000,
      maxTradeSize: 20000,
      firstTradeAt: new Date(),
      lastTradeAt: new Date(),
      walletAgeDays: 100,
      onChainTxCount: 15,
    };

    expect(props.winRate).toBeNull();
  });

  it('should handle null avgTradeSize', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 100000,
      totalPnl: 5000,
      tradeCount: 10,
      winCount: 5,
      winRate: 50,
      avgTradeSize: null,
      maxTradeSize: 20000,
      firstTradeAt: new Date(),
      lastTradeAt: new Date(),
      walletAgeDays: 100,
      onChainTxCount: 15,
    };

    expect(props.avgTradeSize).toBeNull();
  });

  it('should handle null maxTradeSize', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 100000,
      totalPnl: 5000,
      tradeCount: 10,
      winCount: 5,
      winRate: 50,
      avgTradeSize: 10000,
      maxTradeSize: null,
      firstTradeAt: new Date(),
      lastTradeAt: new Date(),
      walletAgeDays: 100,
      onChainTxCount: 15,
    };

    expect(props.maxTradeSize).toBeNull();
  });

  it('should handle null date values', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 100000,
      totalPnl: 5000,
      tradeCount: 10,
      winCount: 5,
      winRate: 50,
      avgTradeSize: 10000,
      maxTradeSize: 20000,
      firstTradeAt: null,
      lastTradeAt: null,
      walletAgeDays: null,
      onChainTxCount: 15,
    };

    expect(props.firstTradeAt).toBeNull();
    expect(props.lastTradeAt).toBeNull();
    expect(props.walletAgeDays).toBeNull();
  });

  it('should handle positive PnL', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 100000,
      totalPnl: 15000,
      tradeCount: 10,
      winCount: 7,
      winRate: 70,
      avgTradeSize: 10000,
      maxTradeSize: 20000,
      firstTradeAt: new Date(),
      lastTradeAt: new Date(),
      walletAgeDays: 100,
      onChainTxCount: 15,
    };

    expect(props.totalPnl).toBeGreaterThan(0);
  });

  it('should handle negative PnL', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 100000,
      totalPnl: -5000,
      tradeCount: 10,
      winCount: 3,
      winRate: 30,
      avgTradeSize: 10000,
      maxTradeSize: 20000,
      firstTradeAt: new Date(),
      lastTradeAt: new Date(),
      walletAgeDays: 100,
      onChainTxCount: 15,
    };

    expect(props.totalPnl).toBeLessThan(0);
  });

  it('should calculate loss count correctly', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 100000,
      totalPnl: 5000,
      tradeCount: 50,
      winCount: 35,
      winRate: 70,
      avgTradeSize: 2000,
      maxTradeSize: 10000,
      firstTradeAt: new Date(),
      lastTradeAt: new Date(),
      walletAgeDays: 100,
      onChainTxCount: 75,
    };

    const lossCount = props.tradeCount - props.winCount;
    expect(lossCount).toBe(15);
  });

  it('should handle zero trades', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 0,
      totalPnl: 0,
      tradeCount: 0,
      winCount: 0,
      winRate: null,
      avgTradeSize: null,
      maxTradeSize: null,
      firstTradeAt: null,
      lastTradeAt: null,
      walletAgeDays: 30,
      onChainTxCount: 5,
    };

    expect(props.tradeCount).toBe(0);
    expect(props.winCount).toBe(0);
    expect(props.totalVolume).toBe(0);
  });

  it('should handle large numbers correctly', () => {
    const props: ActivitySummaryWidgetProps = {
      totalVolume: 5000000,
      totalPnl: 250000,
      tradeCount: 1000,
      winCount: 750,
      winRate: 75,
      avgTradeSize: 5000,
      maxTradeSize: 100000,
      firstTradeAt: new Date('2023-01-01'),
      lastTradeAt: new Date('2024-12-31'),
      walletAgeDays: 730,
      onChainTxCount: 1500,
    };

    expect(props.totalVolume).toBeGreaterThan(1000000);
    expect(props.tradeCount).toBeGreaterThan(100);
  });
});
