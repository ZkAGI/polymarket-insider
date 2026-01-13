/**
 * Unit tests for CurrentOddsDisplay component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CurrentOddsDisplay } from '../../../app/market/[id]/components/CurrentOddsDisplay';
import { MarketOutcomeData } from '../../../app/market/[id]/components/types';

describe('CurrentOddsDisplay', () => {
  it('renders all outcomes', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.65, probability: 65, change24h: 5 },
      { id: '2', name: 'NO', price: 0.35, probability: 35, change24h: -5 },
    ];

    render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(screen.getByText('YES')).toBeInTheDocument();
    expect(screen.getByText('NO')).toBeInTheDocument();
  });

  it('displays probabilities correctly', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.65, probability: 65.5, change24h: 5 },
    ];

    render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(screen.getByText('65.5%')).toBeInTheDocument();
  });

  it('displays prices correctly', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.654, probability: 65.4, change24h: 5 },
    ];

    render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(screen.getByText('$0.654')).toBeInTheDocument();
  });

  it('displays positive 24h change correctly', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.65, probability: 65, change24h: 5.5 },
    ];

    render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(screen.getByText(/\+5\.5%/)).toBeInTheDocument();
  });

  it('displays negative 24h change correctly', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.65, probability: 65, change24h: -3.2 },
    ];

    render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(screen.getByText(/-3\.2%/)).toBeInTheDocument();
  });

  it('does not display change when undefined', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.65, probability: 65 },
    ];

    const { container } = render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(container.textContent).not.toContain('24h');
  });

  it('sorts outcomes by probability descending', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'Option A', price: 0.2, probability: 20 },
      { id: '2', name: 'Option B', price: 0.5, probability: 50 },
      { id: '3', name: 'Option C', price: 0.3, probability: 30 },
    ];

    const { container } = render(<CurrentOddsDisplay outcomes={outcomes} />);

    const outcomeElements = container.querySelectorAll('.text-lg.font-semibold');
    expect(outcomeElements[0]?.textContent).toBe('Option B'); // 50%
    expect(outcomeElements[1]?.textContent).toBe('Option C'); // 30%
    expect(outcomeElements[2]?.textContent).toBe('Option A'); // 20%
  });

  it('displays correct icons for YES/NO outcomes', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.65, probability: 65 },
      { id: '2', name: 'NO', price: 0.35, probability: 35 },
    ];

    const { container } = render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(container.textContent).toContain('✅');
    expect(container.textContent).toContain('❌');
  });

  it('displays default icon for other outcomes', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'Option A', price: 0.5, probability: 50 },
    ];

    const { container } = render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(container.textContent).toContain('🔹');
  });

  it('renders probability bar with correct width', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.75, probability: 75 },
    ];

    const { container } = render(<CurrentOddsDisplay outcomes={outcomes} />);

    const bar = container.querySelector('.bg-blue-600');
    expect(bar).toHaveStyle({ width: '75%' });
  });

  it('handles multiple outcomes correctly', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'Option A', price: 0.4, probability: 40 },
      { id: '2', name: 'Option B', price: 0.3, probability: 30 },
      { id: '3', name: 'Option C', price: 0.3, probability: 30 },
    ];

    render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('displays tip text correctly', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.65, probability: 65 },
    ];

    render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(screen.getByText(/Probabilities represent/i)).toBeInTheDocument();
    expect(screen.getByText(/Share prices reflect/i)).toBeInTheDocument();
  });

  it('applies correct CSS classes', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0.65, probability: 65 },
    ];

    const { container } = render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
    expect(container.querySelector('.shadow-md')).toBeInTheDocument();
  });

  it('handles edge case: 0% probability', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 0, probability: 0 },
    ];

    const { container } = render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(screen.getByText('0.0%')).toBeInTheDocument();
    const bar = container.querySelector('.bg-blue-600');
    expect(bar).toHaveStyle({ width: '0%' });
  });

  it('handles edge case: 100% probability', () => {
    const outcomes: MarketOutcomeData[] = [
      { id: '1', name: 'YES', price: 1, probability: 100 },
    ];

    const { container } = render(<CurrentOddsDisplay outcomes={outcomes} />);

    expect(screen.getByText('100.0%')).toBeInTheDocument();
    const bar = container.querySelector('.bg-blue-600');
    expect(bar).toHaveStyle({ width: '100%' });
  });
});
