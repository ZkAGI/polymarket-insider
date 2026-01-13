/**
 * Unit tests for MarketInfoSection component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketInfoSection } from '../../../app/market/[id]/components/MarketInfoSection';
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
    endDate: new Date('2025-12-31'),
    updatedAt: new Date('2024-01-15'),
    polymarketUrl: 'https://polymarket.com/will-bitcoin-hit-100k-by-end-of-2024',
    resolutionSource: 'CoinMarketCap',
    ...overrides,
  };
}

describe('MarketInfoSection', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });

    // Mock window.alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders component title', () => {
    const market = createMockMarket();
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/Market Information/i)).toBeInTheDocument();
  });

  it('displays active status for active markets', () => {
    const market = createMockMarket({ active: true, closed: false });
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/● Active/i)).toBeInTheDocument();
  });

  it('displays closed status for closed markets', () => {
    const market = createMockMarket({ active: false, closed: true });
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/● Closed/i)).toBeInTheDocument();
  });

  it('displays inactive status for inactive markets', () => {
    const market = createMockMarket({ active: false, closed: false });
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/● Inactive/i)).toBeInTheDocument();
  });

  it('displays days remaining when end date is in future', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const market = createMockMarket({ endDate: futureDate });
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/10 days remaining/i)).toBeInTheDocument();
  });

  it('displays "Ends today" when end date is today', () => {
    const today = new Date();
    today.setHours(23, 59, 59); // Set to end of day
    const market = createMockMarket({ endDate: today });
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/Ends today/i)).toBeInTheDocument();
  });

  it('displays "1 day remaining" for singular day', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const market = createMockMarket({ endDate: tomorrow });
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/1 day remaining/i)).toBeInTheDocument();
  });

  it('displays "Ended" when end date is in past', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const market = createMockMarket({ endDate: pastDate });
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/Ended/i)).toBeInTheDocument();
  });

  it('does not display time remaining when end date is null', () => {
    const market = createMockMarket({ endDate: null });
    const { container } = render(<MarketInfoSection market={market} />);

    expect(container.textContent).not.toContain('Time Remaining');
  });

  it('displays resolution source when available', () => {
    const market = createMockMarket({ resolutionSource: 'Official Government Data' });
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/Official Government Data/i)).toBeInTheDocument();
  });

  it('does not display resolution source when not available', () => {
    const market = createMockMarket({ resolutionSource: undefined });
    const { container } = render(<MarketInfoSection market={market} />);

    expect(container.textContent).not.toContain('Resolution Source');
  });

  it('displays last updated timestamp', () => {
    const market = createMockMarket({ updatedAt: new Date('2024-06-15T14:30:00') });
    render(<MarketInfoSection market={market} />);

    // Check for date components
    expect(screen.getByText(/Jun 15, 2024/i)).toBeInTheDocument();
  });

  it('renders Polymarket link with correct URL', () => {
    const market = createMockMarket();
    render(<MarketInfoSection market={market} />);

    const link = screen.getByText(/View on Polymarket/i).closest('a');
    expect(link).toHaveAttribute('href', market.polymarketUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('copies market ID to clipboard when button is clicked', () => {
    const market = createMockMarket({ id: 'test-market-123' });
    render(<MarketInfoSection market={market} />);

    const copyIdButton = screen.getByText(/Copy Market ID/i);
    fireEvent.click(copyIdButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-market-123');
    expect(window.alert).toHaveBeenCalledWith('Market ID copied to clipboard!');
  });

  it('copies market URL to clipboard when button is clicked', () => {
    const market = createMockMarket();
    const originalLocation = window.location;

    // Type-safe location mocking
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost:3000/market/test-123' },
      writable: true,
      configurable: true,
    });

    render(<MarketInfoSection market={market} />);

    const copyUrlButton = screen.getByText(/Share Market/i);
    fireEvent.click(copyUrlButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/market/test-123');
    expect(window.alert).toHaveBeenCalledWith('Market URL copied to clipboard!');

    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('displays info note about tracking suspicious activity', () => {
    const market = createMockMarket();
    render(<MarketInfoSection market={market} />);

    expect(screen.getByText(/tracks suspicious activity/i)).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const market = createMockMarket();
    const { container } = render(<MarketInfoSection market={market} />);

    expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
    expect(container.querySelector('.shadow-md')).toBeInTheDocument();
  });
});
