/**
 * Tests for WalletPnLChart Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletPnLChart, type PnLDataPoint } from '@/app/wallet/[address]/components/WalletPnLChart';

describe('WalletPnLChart', () => {
  // Mock data
  const generateMockData = (days: number): PnLDataPoint[] => {
    const now = new Date();
    const data: PnLDataPoint[] = [];
    let cumulative = 0;

    for (let i = 0; i < days; i++) {
      const timestamp = new Date(now.getTime() - (days - i) * 24 * 60 * 60 * 1000);
      const dailyPnL = (Math.random() - 0.5) * 1000; // Random daily P&L
      cumulative += dailyPnL;

      data.push({
        timestamp,
        cumulativePnL: cumulative,
        dailyPnL,
      });
    }

    return data;
  };

  describe('Rendering', () => {
    it('should render with default props', () => {
      const data = generateMockData(30);
      render(<WalletPnLChart data={data} />);

      expect(screen.getByText('Profit & Loss Over Time')).toBeInTheDocument();
    });

    it('should render with custom title', () => {
      const data = generateMockData(30);
      render(<WalletPnLChart data={data} title="Custom P&L Chart" />);

      expect(screen.getByText('Custom P&L Chart')).toBeInTheDocument();
    });

    it('should render time range selector when enabled', () => {
      const data = generateMockData(30);
      render(<WalletPnLChart data={data} showTimeRangeSelector={true} />);

      expect(screen.getByText('1D')).toBeInTheDocument();
      expect(screen.getByText('1W')).toBeInTheDocument();
      expect(screen.getByText('1M')).toBeInTheDocument();
      expect(screen.getByText('3M')).toBeInTheDocument();
      expect(screen.getByText('1Y')).toBeInTheDocument();
      expect(screen.getByText('ALL')).toBeInTheDocument();
    });

    it('should not render time range selector when disabled', () => {
      const data = generateMockData(30);
      render(<WalletPnLChart data={data} showTimeRangeSelector={false} />);

      expect(screen.queryByText('1D')).not.toBeInTheDocument();
    });

    it('should show empty state when no data', () => {
      render(<WalletPnLChart data={[]} />);

      expect(screen.getByText('No P&L data available for this time range')).toBeInTheDocument();
    });
  });

  describe('P&L Display', () => {
    it('should display positive P&L with green color', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date('2024-01-01'),
          cumulativePnL: 0,
          dailyPnL: 0,
        },
        {
          timestamp: new Date('2024-01-02'),
          cumulativePnL: 1000,
          dailyPnL: 1000,
        },
      ];

      const { container } = render(<WalletPnLChart data={data} />);

      // Check for green color classes
      const greenElements = container.querySelectorAll('.text-green-600, .dark\\:text-green-400');
      expect(greenElements.length).toBeGreaterThan(0);
    });

    it('should display negative P&L with red color', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date('2024-01-01'),
          cumulativePnL: 0,
          dailyPnL: 0,
        },
        {
          timestamp: new Date('2024-01-02'),
          cumulativePnL: -1000,
          dailyPnL: -1000,
        },
      ];

      const { container } = render(<WalletPnLChart data={data} />);

      // Check for red color classes
      const redElements = container.querySelectorAll('.text-red-600, .dark\\:text-red-400');
      expect(redElements.length).toBeGreaterThan(0);
    });

    it('should format large numbers with k suffix', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date('2024-01-01'),
          cumulativePnL: 0,
          dailyPnL: 0,
        },
        {
          timestamp: new Date('2024-01-02'),
          cumulativePnL: 5000,
          dailyPnL: 5000,
        },
      ];

      render(<WalletPnLChart data={data} />);

      expect(screen.getByText(/\$5\.00k/)).toBeInTheDocument();
    });

    it('should format millions with M suffix', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date('2024-01-01'),
          cumulativePnL: 0,
          dailyPnL: 0,
        },
        {
          timestamp: new Date('2024-01-02'),
          cumulativePnL: 2500000,
          dailyPnL: 2500000,
        },
      ];

      render(<WalletPnLChart data={data} />);

      expect(screen.getByText(/\$2\.50M/)).toBeInTheDocument();
    });

    it('should display percentage change', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date('2024-01-01'),
          cumulativePnL: 1000,
          dailyPnL: 1000,
        },
        {
          timestamp: new Date('2024-01-02'),
          cumulativePnL: 1500,
          dailyPnL: 500,
        },
      ];

      const { container } = render(<WalletPnLChart data={data} />);

      // Should show percentage change
      expect(container.textContent).toMatch(/\d+\.\d+%/);
    });
  });

  describe('Time Range Filtering', () => {
    it('should filter data by time range', () => {
      const data = generateMockData(365); // 1 year of data
      render(<WalletPnLChart data={data} showTimeRangeSelector={true} />);

      // Click on 1M button
      const oneMonthButton = screen.getByText('1M');
      fireEvent.click(oneMonthButton);

      // Should be highlighted/active
      expect(oneMonthButton.className).toContain('bg-white');
    });

    it('should default to ALL time range', () => {
      const data = generateMockData(30);
      render(<WalletPnLChart data={data} showTimeRangeSelector={true} />);

      const allButton = screen.getByText('ALL');
      expect(allButton.className).toContain('bg-white');
    });

    it('should switch between time ranges', () => {
      const data = generateMockData(365);
      render(<WalletPnLChart data={data} showTimeRangeSelector={true} />);

      // Initially ALL is selected
      expect(screen.getByText('ALL').className).toContain('bg-white');

      // Click 1W
      fireEvent.click(screen.getByText('1W'));
      expect(screen.getByText('1W').className).toContain('bg-white');
      expect(screen.getByText('ALL').className).not.toContain('bg-white');

      // Click 1M
      fireEvent.click(screen.getByText('1M'));
      expect(screen.getByText('1M').className).toContain('bg-white');
      expect(screen.getByText('1W').className).not.toContain('bg-white');
    });
  });

  describe('SVG Chart Rendering', () => {
    it('should render SVG chart', () => {
      const data = generateMockData(30);
      const { container } = render(<WalletPnLChart data={data} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render line path', () => {
      const data = generateMockData(30);
      const { container } = render(<WalletPnLChart data={data} />);

      const paths = container.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should render data points as circles', () => {
      const data = generateMockData(5); // Small number for easier testing
      const { container } = render(<WalletPnLChart data={data} />);

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(data.length);
    });

    it('should render zero line', () => {
      const data = generateMockData(30);
      const { container } = render(<WalletPnLChart data={data} />);

      const line = container.querySelector('line');
      expect(line).toBeInTheDocument();
    });
  });

  describe('Interactivity', () => {
    it('should show tooltip on hover', () => {
      const data = generateMockData(5);
      const { container } = render(<WalletPnLChart data={data} />);

      const circles = container.querySelectorAll('circle');
      if (circles[0]) {
        fireEvent.mouseEnter(circles[0]);

        // Tooltip should appear
        const tooltip = container.querySelector('.absolute.bg-gray-900');
        expect(tooltip).toBeInTheDocument();
      }
    });

    it('should hide tooltip on mouse leave', () => {
      const data = generateMockData(5);
      const { container } = render(<WalletPnLChart data={data} />);

      const svg = container.querySelector('svg');
      if (svg) {
        const circles = container.querySelectorAll('circle');
        if (circles[0]) {
          fireEvent.mouseEnter(circles[0]);
          fireEvent.mouseLeave(svg);

          // Tooltip should be hidden
          const tooltip = container.querySelector('.absolute.bg-gray-900');
          expect(tooltip).not.toBeInTheDocument();
        }
      }
    });
  });

  describe('Date Formatting', () => {
    it('should format dates appropriately for different time ranges', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date('2024-01-01T10:30:00'),
          cumulativePnL: 1000,
          dailyPnL: 1000,
        },
        {
          timestamp: new Date('2024-01-15T14:30:00'),
          cumulativePnL: 1500,
          dailyPnL: 500,
        },
      ];

      render(<WalletPnLChart data={data} showTimeRangeSelector={true} />);

      // Should show month and year for longer ranges
      expect(screen.getByText(/Jan/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single data point', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date(),
          cumulativePnL: 100,
          dailyPnL: 100,
        },
      ];

      render(<WalletPnLChart data={data} />);

      expect(screen.getByText('Profit & Loss Over Time')).toBeInTheDocument();
    });

    it('should handle zero P&L', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date('2024-01-01'),
          cumulativePnL: 0,
          dailyPnL: 0,
        },
        {
          timestamp: new Date('2024-01-02'),
          cumulativePnL: 0,
          dailyPnL: 0,
        },
      ];

      render(<WalletPnLChart data={data} />);

      expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date('2024-01-01'),
          cumulativePnL: 0,
          dailyPnL: 0,
        },
        {
          timestamp: new Date('2024-01-02'),
          cumulativePnL: 10000000,
          dailyPnL: 10000000,
        },
      ];

      render(<WalletPnLChart data={data} />);

      expect(screen.getByText(/\$10\.00M/)).toBeInTheDocument();
    });

    it('should handle volatile data with large swings', () => {
      const data: PnLDataPoint[] = [
        {
          timestamp: new Date('2024-01-01'),
          cumulativePnL: 0,
          dailyPnL: 0,
        },
        {
          timestamp: new Date('2024-01-02'),
          cumulativePnL: 10000,
          dailyPnL: 10000,
        },
        {
          timestamp: new Date('2024-01-03'),
          cumulativePnL: -5000,
          dailyPnL: -15000,
        },
        {
          timestamp: new Date('2024-01-04'),
          cumulativePnL: 8000,
          dailyPnL: 13000,
        },
      ];

      const { container } = render(<WalletPnLChart data={data} />);

      // Should render without errors
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper structure for screen readers', () => {
      const data = generateMockData(30);
      const { container } = render(<WalletPnLChart data={data} />);

      expect(screen.getByText('Profit & Loss Over Time')).toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
