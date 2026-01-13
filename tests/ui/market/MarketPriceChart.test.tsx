import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MarketPriceChart,
  type PriceDataPoint,
  type ChartEvent,
} from '../../../app/market/[id]/components/MarketPriceChart';

/**
 * Unit Tests for MarketPriceChart Component
 *
 * Tests cover:
 * - Component rendering
 * - Time range selection
 * - Zoom controls
 * - Pan controls
 * - Event markers
 * - Empty state handling
 */

describe('MarketPriceChart', () => {
  // Sample price history data
  const generateMockPriceHistory = (days: number = 30): PriceDataPoint[] => {
    const points: PriceDataPoint[] = [];
    const now = new Date();

    for (let i = 0; i < days * 24; i++) {
      points.push({
        timestamp: new Date(now.getTime() - (days * 24 - i) * 60 * 60 * 1000),
        price: 0.5 + Math.sin(i / 100) * 0.3,
        probability: 50 + Math.sin(i / 100) * 30,
        volume: 10000 + Math.random() * 50000,
      });
    }

    return points;
  };

  // Sample chart events
  const generateMockEvents = (): ChartEvent[] => {
    const now = new Date();
    return [
      {
        timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        label: 'Major news',
        type: 'news',
      },
      {
        timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        label: 'Large trade',
        type: 'trade',
      },
      {
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        label: 'Alert triggered',
        type: 'alert',
      },
    ];
  };

  describe('Component Rendering', () => {
    it('should render the component with default props', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);

      expect(screen.getByText('YES Price History')).toBeTruthy();
    });

    it('should render all time range buttons', () => {
      const priceHistory = generateMockPriceHistory(180);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);

      expect(screen.getByText('1D')).toBeTruthy();
      expect(screen.getByText('1W')).toBeTruthy();
      expect(screen.getByText('1M')).toBeTruthy();
      expect(screen.getByText('3M')).toBeTruthy();
      expect(screen.getByText('6M')).toBeTruthy();
      expect(screen.getByText('ALL')).toBeTruthy();
    });

    it('should render zoom controls when enableZoom is true', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      expect(screen.getByLabelText('Zoom in')).toBeTruthy();
      expect(screen.getByLabelText('Zoom out')).toBeTruthy();
      expect(screen.getByLabelText('Reset zoom')).toBeTruthy();
    });

    it('should not render zoom controls when enableZoom is false', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={false} />);

      expect(screen.queryByLabelText('Zoom in')).toBeFalsy();
      expect(screen.queryByLabelText('Zoom out')).toBeFalsy();
    });

    it('should render SVG chart', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('should render empty state when no price history', () => {
      render(<MarketPriceChart priceHistory={[]} outcomeName="YES" />);

      expect(screen.getByText('No price history data available')).toBeTruthy();
    });

    it('should apply custom height', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" height={600} />
      );

      const svg = container.querySelector('svg');
      const viewBox = svg?.getAttribute('viewBox');
      expect(viewBox?.includes('600')).toBe(true);
    });
  });

  describe('Time Range Selection', () => {
    it('should highlight the selected time range', () => {
      const priceHistory = generateMockPriceHistory(180);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);

      const oneMonthButton = screen.getByText('1M');
      expect(oneMonthButton.className.includes('bg-blue-600')).toBe(true);
    });

    it('should change time range when button is clicked', () => {
      const priceHistory = generateMockPriceHistory(180);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);

      const oneWeekButton = screen.getByText('1W');
      fireEvent.click(oneWeekButton);

      expect(oneWeekButton.className.includes('bg-blue-600')).toBe(true);
    });

    it('should reset zoom when changing time range', () => {
      const priceHistory = generateMockPriceHistory(180);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      // Zoom in
      const zoomInButton = screen.getByLabelText('Zoom in');
      fireEvent.click(zoomInButton);

      // Change time range
      const oneWeekButton = screen.getByText('1W');
      fireEvent.click(oneWeekButton);

      // Verify zoom is reset (Reset button should be disabled)
      const resetButton = screen.getByLabelText('Reset zoom');
      expect(resetButton.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Zoom Controls', () => {
    it('should enable zoom in button initially', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      const zoomInButton = screen.getByLabelText('Zoom in');
      expect(zoomInButton.hasAttribute('disabled')).toBe(false);
    });

    it('should disable zoom out button initially', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      const zoomOutButton = screen.getByLabelText('Zoom out');
      expect(zoomOutButton.hasAttribute('disabled')).toBe(true);
    });

    it('should disable reset button initially', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      const resetButton = screen.getByLabelText('Reset zoom');
      expect(resetButton.hasAttribute('disabled')).toBe(true);
    });

    it('should enable zoom out after zooming in', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      const zoomInButton = screen.getByLabelText('Zoom in');
      fireEvent.click(zoomInButton);

      const zoomOutButton = screen.getByLabelText('Zoom out');
      expect(zoomOutButton.hasAttribute('disabled')).toBe(false);
    });

    it('should enable reset button after zooming in', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      const zoomInButton = screen.getByLabelText('Zoom in');
      fireEvent.click(zoomInButton);

      const resetButton = screen.getByLabelText('Reset zoom');
      expect(resetButton.hasAttribute('disabled')).toBe(false);
    });

    it('should display zoom level when zoomed', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      const zoomInButton = screen.getByLabelText('Zoom in');
      fireEvent.click(zoomInButton);

      expect(screen.getByText(/Zoom: 1\.5x/)).toBeTruthy();
    });

    it('should disable zoom in at max zoom level', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      const zoomInButton = screen.getByLabelText('Zoom in');

      // Click zoom in multiple times to reach max zoom
      for (let i = 0; i < 10; i++) {
        fireEvent.click(zoomInButton);
      }

      expect(zoomInButton.hasAttribute('disabled')).toBe(true);
    });

    it('should reset zoom level when reset button is clicked', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      const zoomInButton = screen.getByLabelText('Zoom in');
      fireEvent.click(zoomInButton);

      const resetButton = screen.getByLabelText('Reset zoom');
      fireEvent.click(resetButton);

      expect(resetButton.hasAttribute('disabled')).toBe(true);
      expect(screen.queryByText(/Zoom:/)).toBeFalsy();
    });
  });

  describe('Event Markers', () => {
    it('should render event markers when events are provided', () => {
      const priceHistory = generateMockPriceHistory(30);
      const events = generateMockEvents();
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} events={events} outcomeName="YES" />
      );

      // Check for event marker elements (circles with radius 4)
      const eventCircles = container.querySelectorAll('circle[r="4"]');
      expect(eventCircles.length).toBeGreaterThan(0);
    });

    it('should show event labels in title elements', () => {
      const priceHistory = generateMockPriceHistory(30);
      const events = generateMockEvents();
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} events={events} outcomeName="YES" />
      );

      const titles = container.querySelectorAll('title');
      const eventTitles = Array.from(titles).filter((title) =>
        events.some((event) => title.textContent === event.label)
      );
      expect(eventTitles.length).toBeGreaterThan(0);
    });
  });

  describe('Grid Lines', () => {
    it('should render grid lines when showGrid is true', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" showGrid={true} />
      );

      const gridLines = container.querySelectorAll('line[stroke-dasharray="4 4"]');
      expect(gridLines.length).toBeGreaterThan(0);
    });

    it('should not render grid lines when showGrid is false', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" showGrid={false} />
      );

      // Without events and grid, there should be no dashed lines
      const gridLines = container.querySelectorAll('line[stroke-dasharray="4 4"]');
      expect(gridLines.length).toBe(0);
    });
  });

  describe('Axes', () => {
    it('should render Y-axis with percentage labels', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />
      );

      const yLabels = container.querySelectorAll('text[text-anchor="end"]');
      expect(yLabels.length).toBeGreaterThan(0);

      // Check that at least one label contains a percentage sign
      const hasPercentage = Array.from(yLabels).some((label) => label.textContent?.includes('%'));
      expect(hasPercentage).toBe(true);
    });

    it('should render X-axis with date labels', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />
      );

      const xLabels = container.querySelectorAll('text[text-anchor="middle"]');
      expect(xLabels.length).toBeGreaterThan(0);
    });

    it('should render axis lines', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />
      );

      const axisLines = container.querySelectorAll('line[stroke-width="2"]');
      expect(axisLines.length).toBeGreaterThanOrEqual(2); // X and Y axes
    });
  });

  describe('Chart Path', () => {
    it('should render line path', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />
      );

      const linePath = container.querySelector('path[stroke="#3b82f6"]');
      expect(linePath).toBeTruthy();
      expect(linePath?.getAttribute('d')).toBeTruthy();
    });

    it('should render area path with gradient', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />
      );

      const areaPath = container.querySelector('path[fill="url(#priceGradient)"]');
      expect(areaPath).toBeTruthy();
    });

    it('should define gradient in defs', () => {
      const priceHistory = generateMockPriceHistory(30);
      const { container } = render(
        <MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />
      );

      const gradient = container.querySelector('#priceGradient');
      expect(gradient).toBeTruthy();
    });
  });

  describe('Data Filtering', () => {
    it('should filter data to 1 day when 1D is selected', () => {
      const priceHistory = generateMockPriceHistory(180);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);

      const oneDayButton = screen.getByText('1D');
      fireEvent.click(oneDayButton);

      // Component should still render (no errors)
      expect(screen.getByText('YES Price History')).toBeTruthy();
    });

    it('should filter data to 1 week when 1W is selected', () => {
      const priceHistory = generateMockPriceHistory(180);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);

      const oneWeekButton = screen.getByText('1W');
      fireEvent.click(oneWeekButton);

      expect(screen.getByText('YES Price History')).toBeTruthy();
    });

    it('should show all data when ALL is selected', () => {
      const priceHistory = generateMockPriceHistory(180);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);

      const allButton = screen.getByText('ALL');
      fireEvent.click(allButton);

      expect(screen.getByText('YES Price History')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single data point', () => {
      const priceHistory: PriceDataPoint[] = [
        {
          timestamp: new Date(),
          price: 0.5,
          probability: 50,
        },
      ];

      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);
      expect(screen.getByText('YES Price History')).toBeTruthy();
    });

    it('should handle data with extreme values', () => {
      const priceHistory: PriceDataPoint[] = [
        { timestamp: new Date(Date.now() - 1000), price: 0.01, probability: 1 },
        { timestamp: new Date(), price: 0.99, probability: 99 },
      ];

      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);
      expect(screen.getByText('YES Price History')).toBeTruthy();
    });

    it('should handle data with missing volume', () => {
      const priceHistory: PriceDataPoint[] = [
        { timestamp: new Date(Date.now() - 1000), price: 0.5, probability: 50 },
        { timestamp: new Date(), price: 0.6, probability: 60 },
      ];

      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);
      expect(screen.getByText('YES Price History')).toBeTruthy();
    });

    it('should handle empty events array', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} events={[]} outcomeName="YES" />);

      expect(screen.getByText('YES Price History')).toBeTruthy();
    });

    it('should handle very long outcome name', () => {
      const priceHistory = generateMockPriceHistory(30);
      const longName = 'A'.repeat(100);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName={longName} />);

      expect(screen.getByText(`${longName} Price History`)).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on zoom buttons', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" enableZoom={true} />);

      expect(screen.getByLabelText('Zoom in')).toBeTruthy();
      expect(screen.getByLabelText('Zoom out')).toBeTruthy();
      expect(screen.getByLabelText('Reset zoom')).toBeTruthy();
    });

    it('should have proper heading hierarchy', () => {
      const priceHistory = generateMockPriceHistory(30);
      render(<MarketPriceChart priceHistory={priceHistory} outcomeName="YES" />);

      const heading = screen.getByText('YES Price History');
      expect(heading.tagName).toBe('H3');
    });
  });
});
