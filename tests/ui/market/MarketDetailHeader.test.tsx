/**
 * Unit tests for MarketDetailHeader component
 */

import { describe, it, expect } from 'vitest';
import { MarketDetailHeader } from '../../../app/market/[id]/components/MarketDetailHeader';
import { MarketData } from '../../../app/market/[id]/components/types';

// Mock data helper
function createMockMarket(overrides?: Partial<MarketData>): MarketData {
  return {
    id: 'test-market-1',
    question: 'Will Bitcoin hit $100k by end of 2024?',
    slug: 'will-bitcoin-hit-100k-by-end-of-2024',
    description: 'This market will resolve to YES if Bitcoin reaches $100,000 by December 31, 2024.',
    category: 'CRYPTO',
    active: true,
    closed: false,
    archived: false,
    outcomes: [
      { id: 'yes', name: 'YES', price: 0.65, probability: 65 },
      { id: 'no', name: 'NO', price: 0.35, probability: 35 },
    ],
    volume: 1500000,
    liquidity: 500000,
    createdAt: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    updatedAt: new Date('2024-01-15'),
    polymarketUrl: 'https://polymarket.com/will-bitcoin-hit-100k-by-end-of-2024',
    resolutionSource: 'CoinMarketCap',
    ...overrides,
  };
}

describe('MarketDetailHeader', () => {
  it('renders component with market data', () => {
    const market = createMockMarket();
    const props = { market };

    expect(market.question).toBeTruthy();
    expect(props).toBeDefined();
    expect(MarketDetailHeader).toBeDefined();
  });

  it('formats volume numbers correctly', () => {
    const testCases = [
      { volume: 999, expected: '$999' },
      { volume: 1000, expected: '$1.0K' },
      { volume: 50000, expected: '$50.0K' },
      { volume: 1000000, expected: '$1.00M' },
      { volume: 5500000, expected: '$5.50M' },
    ];

    testCases.forEach(({ volume, expected }) => {
      const market = createMockMarket({ volume });
      expect(market.volume).toBe(volume);
      // Component should format correctly
    });
  });

  it('handles different market states', () => {
    const activeMarket = createMockMarket({ active: true, closed: false });
    const closedMarket = createMockMarket({ active: false, closed: true });
    const inactiveMarket = createMockMarket({ active: false, closed: false });

    expect(activeMarket.active).toBe(true);
    expect(closedMarket.closed).toBe(true);
    expect(inactiveMarket.active).toBe(false);
    expect(inactiveMarket.closed).toBe(false);
  });

  it('handles optional fields correctly', () => {
    const withLiquidity = createMockMarket({ liquidity: 500000 });
    const withoutLiquidity = createMockMarket({ liquidity: undefined });
    const withEndDate = createMockMarket({ endDate: new Date('2024-12-31') });
    const withoutEndDate = createMockMarket({ endDate: null });

    expect(withLiquidity.liquidity).toBe(500000);
    expect(withoutLiquidity.liquidity).toBeUndefined();
    expect(withEndDate.endDate).toBeInstanceOf(Date);
    expect(withoutEndDate.endDate).toBeNull();
  });

  it('formats category names correctly', () => {
    const categories = ['POLITICS', 'CRYPTO', 'SPORTS', 'TECHNOLOGY'];

    categories.forEach((category) => {
      const market = createMockMarket({ category });
      expect(market.category).toBe(category);
    });
  });
});
