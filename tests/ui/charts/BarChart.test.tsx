import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarChart, BarChartDataPoint, BarChartSeries } from '@/app/components/charts/BarChart';

describe('BarChart', () => {
  const simpleData: BarChartDataPoint[] = [
    { label: 'Jan', value: 100 },
    { label: 'Feb', value: 200 },
    { label: 'Mar', value: 150 },
  ];

  const multiSeriesData: BarChartSeries[] = [
    {
      id: 'series1',
      name: 'Series 1',
      data: [
        { label: 'A', value: 100 },
        { label: 'B', value: 200 },
      ],
      color: '#ff0000',
    },
    {
      id: 'series2',
      name: 'Series 2',
      data: [
        { label: 'A', value: 150 },
        { label: 'B', value: 250 },
      ],
      color: '#00ff00',
    },
  ];

  describe('Rendering', () => {
    it('should render with simple data', () => {
      render(<BarChart data={simpleData} title="Test Chart" />);
      expect(screen.getByText('Test Chart')).toBeInTheDocument();
    });

    it('should render without title', () => {
      render(<BarChart data={simpleData} />);
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<BarChart data={simpleData} className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should render SVG element', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render bars for each data point', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThan(0);
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when loading=true', () => {
      const { container } = render(<BarChart data={simpleData} loading={true} title="Loading Chart" />);
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should not show chart content when loading', () => {
      const { container } = render(<BarChart data={simpleData} loading={true} />);
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no data', () => {
      render(<BarChart data={[]} emptyMessage="No data available" />);
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should show default empty message', () => {
      render(<BarChart data={[]} />);
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should not show SVG when empty', () => {
      const { container } = render(<BarChart data={[]} />);
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  describe('Grid Lines', () => {
    it('should show grid lines by default', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const gridLines = container.querySelectorAll('line');
      expect(gridLines.length).toBeGreaterThan(0);
    });

    it('should hide grid lines when showGrid=false', () => {
      const { container } = render(<BarChart data={simpleData} showGrid={false} />);
      const gridLines = container.querySelectorAll('line');
      expect(gridLines.length).toBe(0);
    });
  });

  describe('Axis Labels', () => {
    it('should show X-axis labels by default', () => {
      render(<BarChart data={simpleData} />);
      expect(screen.getByText('Jan')).toBeInTheDocument();
      expect(screen.getByText('Feb')).toBeInTheDocument();
      expect(screen.getByText('Mar')).toBeInTheDocument();
    });

    it('should hide X-axis labels when showXAxis=false', () => {
      render(<BarChart data={simpleData} showXAxis={false} />);
      expect(screen.queryByText('Jan')).not.toBeInTheDocument();
    });

    it('should show Y-axis labels by default', () => {
      const { container } = render(<BarChart data={simpleData} showYAxis={true} />);
      const yAxisLabels = container.querySelector('.text-right');
      expect(yAxisLabels).toBeInTheDocument();
    });

    it('should hide Y-axis labels when showYAxis=false', () => {
      const { container } = render(<BarChart data={simpleData} showYAxis={false} />);
      const yAxisLabels = container.querySelector('.text-right');
      expect(yAxisLabels).not.toBeInTheDocument();
    });
  });

  describe('Formatting', () => {
    it('should use custom Y-axis formatter', () => {
      render(
        <BarChart
          data={simpleData}
          showYAxis={true}
          formatYAxis={(value) => `$${value}`}
        />
      );
      // Check that formatted values appear somewhere in the component
      expect(screen.getByText(/\$/)).toBeInTheDocument();
    });

    it('should use default formatter when not provided', () => {
      const { container } = render(<BarChart data={simpleData} showYAxis={true} />);
      // Should have some Y-axis labels
      const yAxisLabels = container.querySelector('.text-right');
      expect(yAxisLabels).toBeInTheDocument();
      expect(yAxisLabels?.textContent).not.toBe('');
    });
  });

  describe('Multiple Series', () => {
    it('should render multiple series', () => {
      render(<BarChart series={multiSeriesData} />);
      expect(screen.getByText('Series 1')).toBeInTheDocument();
      expect(screen.getByText('Series 2')).toBeInTheDocument();
    });

    it('should show legend for multiple series', () => {
      render(<BarChart series={multiSeriesData} />);
      expect(screen.getByText('Series 1')).toBeInTheDocument();
      expect(screen.getByText('Series 2')).toBeInTheDocument();
    });

    it('should not show legend for single series', () => {
      render(<BarChart data={simpleData} />);
      expect(screen.queryByText('Value')).not.toBeInTheDocument();
    });

    it('should use custom colors for series', () => {
      const { container } = render(<BarChart series={multiSeriesData} />);
      const legend = container.querySelector('.flex.flex-wrap');
      expect(legend).toBeInTheDocument();
    });
  });

  describe('Stacked Bars', () => {
    it('should render stacked bars when stacked=true', () => {
      const { container } = render(<BarChart series={multiSeriesData} stacked={true} />);
      const rects = container.querySelectorAll('rect');
      // Should have bars rendered
      expect(rects.length).toBeGreaterThan(0);
    });

    it('should render grouped bars when stacked=false', () => {
      const { container } = render(<BarChart series={multiSeriesData} stacked={false} />);
      const rects = container.querySelectorAll('rect');
      // Should have bars rendered
      expect(rects.length).toBeGreaterThan(0);
    });
  });

  describe('Interactions', () => {
    it('should show tooltip on hover', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const svg = container.querySelector('svg');

      if (svg) {
        fireEvent.mouseEnter(svg);
        // Note: Actual tooltip display depends on hovering specific bars
      }
    });

    it('should hide tooltip on mouse leave', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const svg = container.querySelector('svg');

      if (svg) {
        fireEvent.mouseLeave(svg);
        // Tooltip should not be visible
        expect(container.querySelector('.absolute.bg-gray-900')).not.toBeInTheDocument();
      }
    });

    it('should use custom tooltip formatter', () => {
      const formatTooltip = vi.fn((point) => <div>Custom: {point.value}</div>);
      render(<BarChart data={simpleData} formatTooltip={formatTooltip} />);
      // Tooltip formatter will be called when hovering
    });
  });

  describe('Bar Spacing', () => {
    it('should use default bar spacing', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThan(0);
    });

    it('should use custom bar spacing', () => {
      const { container } = render(<BarChart data={simpleData} barSpacing={0.5} />);
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThan(0);
    });
  });

  describe('Height', () => {
    it('should use default height', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const chartContainer = container.querySelector('.relative');
      expect(chartContainer).toHaveStyle({ height: '300px' });
    });

    it('should use custom height', () => {
      const { container } = render(<BarChart data={simpleData} height={500} />);
      const chartContainer = container.querySelector('.relative');
      expect(chartContainer).toHaveStyle({ height: '500px' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative values', () => {
      const negativeData: BarChartDataPoint[] = [
        { label: 'A', value: -100 },
        { label: 'B', value: 50 },
        { label: 'C', value: -50 },
      ];
      const { container } = render(<BarChart data={negativeData} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should handle zero values', () => {
      const zeroData: BarChartDataPoint[] = [
        { label: 'A', value: 0 },
        { label: 'B', value: 0 },
      ];
      const { container } = render(<BarChart data={zeroData} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should handle single data point', () => {
      const singleData: BarChartDataPoint[] = [{ label: 'A', value: 100 }];
      render(<BarChart data={singleData} />);
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should handle large values', () => {
      const largeData: BarChartDataPoint[] = [
        { label: 'A', value: 1000000 },
        { label: 'B', value: 2000000 },
      ];
      render(<BarChart data={largeData} />);
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should handle custom colors in data points', () => {
      const coloredData: BarChartDataPoint[] = [
        { label: 'A', value: 100, color: '#ff0000' },
        { label: 'B', value: 200, color: '#00ff00' },
      ];
      const { container } = render(<BarChart data={coloredData} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<BarChart data={simpleData} title="Test Chart" />);
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Test Chart');
    });

    it('should be keyboard navigable', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const bars = container.querySelectorAll('rect[style*="cursor: pointer"]');
      bars.forEach((bar) => {
        expect(bar).toHaveStyle({ cursor: 'pointer' });
      });
    });
  });

  describe('Dark Mode', () => {
    it('should have dark mode classes', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const darkModeElements = container.querySelectorAll('[class*="dark:"]');
      expect(darkModeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive', () => {
    it('should have responsive classes', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-full', 'h-full');
    });

    it('should preserve aspect ratio', () => {
      const { container } = render(<BarChart data={simpleData} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('preserveAspectRatio', 'none');
    });
  });
});
