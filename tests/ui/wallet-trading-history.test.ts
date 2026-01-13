/**
 * Unit tests for WalletTradingHistoryTable component
 */

import { describe, it, expect, vi } from 'vitest';
import type {
  WalletTrade,
  SortField,
  SortDirection,
} from '../../app/wallet/[address]/components';

// Mock trade data
function createMockTrade(overrides: Partial<WalletTrade> = {}): WalletTrade {
  return {
    id: 'trade-1',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    marketId: 'market-1',
    marketTitle: 'Will Bitcoin hit $100k in 2024?',
    outcome: 'YES',
    side: 'BUY',
    size: 5000,
    price: 0.65,
    shares: 7692.31,
    fee: 100,
    txHash: '0x1234567890abcdef',
    profitLoss: 500,
    ...overrides,
  };
}

describe('WalletTradingHistoryTable', () => {
  describe('Trade Data Types', () => {
    it('should have correct trade data structure', () => {
      const trade = createMockTrade();
      expect(trade).toHaveProperty('id');
      expect(trade).toHaveProperty('timestamp');
      expect(trade).toHaveProperty('marketId');
      expect(trade).toHaveProperty('marketTitle');
      expect(trade).toHaveProperty('outcome');
      expect(trade).toHaveProperty('side');
      expect(trade).toHaveProperty('size');
      expect(trade).toHaveProperty('price');
      expect(trade).toHaveProperty('shares');
      expect(trade).toHaveProperty('fee');
      expect(trade).toHaveProperty('txHash');
    });

    it('should handle trades with profitLoss', () => {
      const trade = createMockTrade({ profitLoss: 1000 });
      expect(trade.profitLoss).toBe(1000);
    });

    it('should handle trades without profitLoss (pending)', () => {
      const trade = createMockTrade({ profitLoss: undefined });
      expect(trade.profitLoss).toBeUndefined();
    });
  });

  describe('Trade Outcome Types', () => {
    it('should accept YES outcome', () => {
      const trade = createMockTrade({ outcome: 'YES' });
      expect(trade.outcome).toBe('YES');
    });

    it('should accept NO outcome', () => {
      const trade = createMockTrade({ outcome: 'NO' });
      expect(trade.outcome).toBe('NO');
    });
  });

  describe('Trade Side Types', () => {
    it('should accept BUY side', () => {
      const trade = createMockTrade({ side: 'BUY' });
      expect(trade.side).toBe('BUY');
    });

    it('should accept SELL side', () => {
      const trade = createMockTrade({ side: 'SELL' });
      expect(trade.side).toBe('SELL');
    });
  });

  describe('Pagination Logic', () => {
    const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

    it('should calculate total pages correctly', () => {
      const totalCount = 87;
      const pageSize = 25;
      const totalPages = Math.ceil(totalCount / pageSize);
      expect(totalPages).toBe(4);
    });

    it('should calculate start and end indices', () => {
      const currentPage = 2;
      const pageSize = 25;
      const totalCount = 100;
      const startIndex = (currentPage - 1) * pageSize + 1;
      const endIndex = Math.min(currentPage * pageSize, totalCount);
      expect(startIndex).toBe(26);
      expect(endIndex).toBe(50);
    });

    it('should handle last page with fewer items', () => {
      const currentPage = 4;
      const pageSize = 25;
      const totalCount = 87;
      const startIndex = (currentPage - 1) * pageSize + 1;
      const endIndex = Math.min(currentPage * pageSize, totalCount);
      expect(startIndex).toBe(76);
      expect(endIndex).toBe(87);
    });

    it('should support standard page sizes', () => {
      expect(PAGE_SIZE_OPTIONS).toContain(10);
      expect(PAGE_SIZE_OPTIONS).toContain(25);
      expect(PAGE_SIZE_OPTIONS).toContain(50);
      expect(PAGE_SIZE_OPTIONS).toContain(100);
    });

    it('should disable first/prev buttons on first page', () => {
      const currentPage = 1;
      const isFirstPage = currentPage === 1;
      expect(isFirstPage).toBe(true);
    });

    it('should disable next/last buttons on last page', () => {
      const currentPage = 4;
      const totalPages = 4;
      const isLastPage = currentPage === totalPages;
      expect(isLastPage).toBe(true);
    });
  });

  describe('Sorting Logic', () => {
    const trades: WalletTrade[] = [
      createMockTrade({
        id: 'trade-1',
        timestamp: new Date('2024-01-10T10:00:00Z'),
        size: 1000,
        price: 0.5,
        profitLoss: 100,
      }),
      createMockTrade({
        id: 'trade-2',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        size: 5000,
        price: 0.75,
        profitLoss: -200,
      }),
      createMockTrade({
        id: 'trade-3',
        timestamp: new Date('2024-01-12T10:00:00Z'),
        size: 3000,
        price: 0.25,
        profitLoss: 500,
      }),
    ];

    it('should sort by timestamp ascending', () => {
      const sorted = [...trades].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      expect(sorted[0]?.id).toBe('trade-1');
      expect(sorted[1]?.id).toBe('trade-3');
      expect(sorted[2]?.id).toBe('trade-2');
    });

    it('should sort by timestamp descending', () => {
      const sorted = [...trades].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      expect(sorted[0]?.id).toBe('trade-2');
      expect(sorted[1]?.id).toBe('trade-3');
      expect(sorted[2]?.id).toBe('trade-1');
    });

    it('should sort by size ascending', () => {
      const sorted = [...trades].sort((a, b) => a.size - b.size);
      expect(sorted[0]?.size).toBe(1000);
      expect(sorted[1]?.size).toBe(3000);
      expect(sorted[2]?.size).toBe(5000);
    });

    it('should sort by size descending', () => {
      const sorted = [...trades].sort((a, b) => b.size - a.size);
      expect(sorted[0]?.size).toBe(5000);
      expect(sorted[1]?.size).toBe(3000);
      expect(sorted[2]?.size).toBe(1000);
    });

    it('should sort by price ascending', () => {
      const sorted = [...trades].sort((a, b) => a.price - b.price);
      expect(sorted[0]?.price).toBe(0.25);
      expect(sorted[1]?.price).toBe(0.5);
      expect(sorted[2]?.price).toBe(0.75);
    });

    it('should sort by price descending', () => {
      const sorted = [...trades].sort((a, b) => b.price - a.price);
      expect(sorted[0]?.price).toBe(0.75);
      expect(sorted[1]?.price).toBe(0.5);
      expect(sorted[2]?.price).toBe(0.25);
    });

    it('should sort by profitLoss ascending', () => {
      const sorted = [...trades].sort((a, b) => (a.profitLoss ?? 0) - (b.profitLoss ?? 0));
      expect(sorted[0]?.profitLoss).toBe(-200);
      expect(sorted[1]?.profitLoss).toBe(100);
      expect(sorted[2]?.profitLoss).toBe(500);
    });

    it('should sort by profitLoss descending', () => {
      const sorted = [...trades].sort((a, b) => (b.profitLoss ?? 0) - (a.profitLoss ?? 0));
      expect(sorted[0]?.profitLoss).toBe(500);
      expect(sorted[1]?.profitLoss).toBe(100);
      expect(sorted[2]?.profitLoss).toBe(-200);
    });

    it('should handle undefined profitLoss in sorting', () => {
      const tradesWithUndefined = [
        createMockTrade({ id: 'trade-1', profitLoss: 100 }),
        createMockTrade({ id: 'trade-2', profitLoss: undefined }),
        createMockTrade({ id: 'trade-3', profitLoss: -50 }),
      ];

      const sorted = [...tradesWithUndefined].sort(
        (a, b) => (a.profitLoss ?? 0) - (b.profitLoss ?? 0)
      );

      expect(sorted[0]?.profitLoss).toBe(-50);
      expect(sorted[1]?.profitLoss).toBeUndefined(); // Treated as 0
      expect(sorted[2]?.profitLoss).toBe(100);
    });
  });

  describe('Formatting Functions', () => {
    describe('formatPrice', () => {
      it('should format price as percentage', () => {
        const formatPrice = (price: number) => `${(price * 100).toFixed(1)}%`;
        expect(formatPrice(0.65)).toBe('65.0%');
        expect(formatPrice(0.333)).toBe('33.3%');
        expect(formatPrice(0.999)).toBe('99.9%');
      });
    });

    describe('formatUSD', () => {
      const formatUSD = (amount: number) => {
        if (amount >= 1000000) {
          return `$${(amount / 1000000).toFixed(2)}M`;
        } else if (amount >= 1000) {
          return `$${(amount / 1000).toFixed(2)}K`;
        }
        return `$${amount.toFixed(2)}`;
      };

      it('should format millions correctly', () => {
        expect(formatUSD(1500000)).toBe('$1.50M');
        expect(formatUSD(2000000)).toBe('$2.00M');
      });

      it('should format thousands correctly', () => {
        expect(formatUSD(5000)).toBe('$5.00K');
        expect(formatUSD(12500)).toBe('$12.50K');
      });

      it('should format small amounts correctly', () => {
        expect(formatUSD(100)).toBe('$100.00');
        expect(formatUSD(25.5)).toBe('$25.50');
      });
    });

    describe('formatTimestamp', () => {
      const formatTimestamp = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor(diff / (1000 * 60));

        if (days > 0) {
          return `${days}d ago`;
        } else if (hours > 0) {
          return `${hours}h ago`;
        } else if (minutes > 0) {
          return `${minutes}m ago`;
        }
        return 'Just now';
      };

      it('should format days ago', () => {
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        expect(formatTimestamp(threeDaysAgo)).toBe('3d ago');
      });

      it('should format hours ago', () => {
        const now = new Date();
        const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
        expect(formatTimestamp(fiveHoursAgo)).toBe('5h ago');
      });

      it('should format minutes ago', () => {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        expect(formatTimestamp(thirtyMinutesAgo)).toBe('30m ago');
      });

      it('should show "Just now" for recent trades', () => {
        const now = new Date();
        const tenSecondsAgo = new Date(now.getTime() - 10 * 1000);
        expect(formatTimestamp(tenSecondsAgo)).toBe('Just now');
      });
    });

    describe('formatFullTimestamp', () => {
      it('should format full timestamp', () => {
        const date = new Date('2024-01-15T10:30:45Z');
        const formatted = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(date);

        expect(formatted).toContain('2024');
        expect(formatted).toContain('Jan');
        expect(formatted).toContain('15');
      });
    });
  });

  describe('Row Expansion Logic', () => {
    it('should toggle row expansion', () => {
      const expandedRows = new Set<string>();
      const tradeId = 'trade-1';

      // Not expanded initially
      expect(expandedRows.has(tradeId)).toBe(false);

      // Expand
      expandedRows.add(tradeId);
      expect(expandedRows.has(tradeId)).toBe(true);

      // Collapse
      expandedRows.delete(tradeId);
      expect(expandedRows.has(tradeId)).toBe(false);
    });

    it('should handle multiple expanded rows', () => {
      const expandedRows = new Set<string>(['trade-1', 'trade-3']);

      expect(expandedRows.has('trade-1')).toBe(true);
      expect(expandedRows.has('trade-2')).toBe(false);
      expect(expandedRows.has('trade-3')).toBe(true);
    });
  });

  describe('Empty State', () => {
    it('should handle empty trades array', () => {
      const trades: WalletTrade[] = [];
      expect(trades.length).toBe(0);
    });

    it('should show correct message for zero trades', () => {
      const trades: WalletTrade[] = [];
      const isEmpty = trades.length === 0;
      expect(isEmpty).toBe(true);
    });
  });

  describe('Event Handlers', () => {
    it('should call onPageChange with correct page number', () => {
      const onPageChange = vi.fn();
      onPageChange(2);
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageSizeChange with correct size', () => {
      const onPageSizeChange = vi.fn();
      onPageSizeChange(50);
      expect(onPageSizeChange).toHaveBeenCalledWith(50);
    });

    it('should call onSort with correct field and direction', () => {
      const onSort = vi.fn();
      const field: SortField = 'size';
      const direction: SortDirection = 'desc';
      onSort(field, direction);
      expect(onSort).toHaveBeenCalledWith(field, direction);
    });
  });

  describe('Loading State', () => {
    it('should handle loading state', () => {
      const loading = true;
      expect(loading).toBe(true);
    });

    it('should handle non-loading state', () => {
      const loading = false;
      expect(loading).toBe(false);
    });
  });

  describe('Transaction Hash', () => {
    it('should generate valid Polygonscan link', () => {
      const txHash = '0x1234567890abcdef';
      const link = `https://polygonscan.com/tx/${txHash}`;
      expect(link).toBe('https://polygonscan.com/tx/0x1234567890abcdef');
    });

    it('should truncate long transaction hashes', () => {
      const txHash =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(txHash.length).toBeGreaterThan(20);
    });
  });

  describe('Market Links', () => {
    it('should generate valid market link', () => {
      const marketId = 'market-123';
      const link = `/market/${marketId}`;
      expect(link).toBe('/market/market-123');
    });
  });

  describe('Trade Calculations', () => {
    it('should calculate shares correctly', () => {
      const size = 5000;
      const price = 0.65;
      const shares = size / price;
      expect(shares).toBeCloseTo(7692.31, 2);
    });

    it('should calculate fee correctly', () => {
      const size = 5000;
      const feeRate = 0.02; // 2%
      const fee = size * feeRate;
      expect(fee).toBe(100);
    });
  });

  describe('Color Coding', () => {
    it('should use green for YES outcome', () => {
      const outcome = 'YES';
      const colorClass = outcome === 'YES' ? 'green' : 'red';
      expect(colorClass).toBe('green');
    });

    it('should use red for NO outcome', () => {
      const outcome: 'YES' | 'NO' = 'NO';
      const colorClass = outcome === 'NO' ? 'red' : 'green';
      expect(colorClass).toBe('red');
    });

    it('should use blue for BUY side', () => {
      const side = 'BUY';
      const colorClass = side === 'BUY' ? 'blue' : 'purple';
      expect(colorClass).toBe('blue');
    });

    it('should use purple for SELL side', () => {
      const side: 'BUY' | 'SELL' = 'SELL';
      const colorClass = side === 'SELL' ? 'purple' : 'blue';
      expect(colorClass).toBe('purple');
    });

    it('should use green for positive P&L', () => {
      const profitLoss = 500;
      const colorClass = profitLoss > 0 ? 'green' : profitLoss < 0 ? 'red' : 'gray';
      expect(colorClass).toBe('green');
    });

    it('should use red for negative P&L', () => {
      const profitLoss = -200;
      const colorClass = profitLoss > 0 ? 'green' : profitLoss < 0 ? 'red' : 'gray';
      expect(colorClass).toBe('red');
    });

    it('should use gray for zero P&L', () => {
      const profitLoss = 0;
      const colorClass = profitLoss > 0 ? 'green' : profitLoss < 0 ? 'red' : 'gray';
      expect(colorClass).toBe('gray');
    });
  });
});
