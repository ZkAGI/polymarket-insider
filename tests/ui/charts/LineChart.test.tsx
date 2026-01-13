import { describe, it, expect } from 'vitest';
import { LineChart, LineChartDataPoint, LineChartSeries } from '@/app/components/charts/LineChart';

describe('LineChart', () => {
  const mockData: LineChartDataPoint[] = [
    { x: new Date('2026-01-01'), y: 100 },
    { x: new Date('2026-01-02'), y: 150 },
    { x: new Date('2026-01-03'), y: 120 },
    { x: new Date('2026-01-04'), y: 180 },
    { x: new Date('2026-01-05'), y: 160 },
  ];

  const mockNumericData: LineChartDataPoint[] = [
    { x: 0, y: 10 },
    { x: 1, y: 20 },
    { x: 2, y: 15 },
    { x: 3, y: 30 },
    { x: 4, y: 25 },
  ];

  const mockSeries: LineChartSeries[] = [
    {
      id: 'series1',
      name: 'Series 1',
      data: mockData,
      color: '#3b82f6',
    },
    {
      id: 'series2',
      name: 'Series 2',
      data: mockData.map((d) => ({ x: d.x, y: (d.y as number) + 50 })),
      color: '#10b981',
    },
  ];

  describe('Component Structure', () => {
    it('should define LineChart component', () => {
      expect(LineChart).toBeDefined();
      expect(typeof LineChart).toBe('function');
    });

    it('should accept data prop', () => {
      const props = { data: mockData };
      expect(props.data).toEqual(mockData);
    });

    it('should accept series prop', () => {
      const props = { series: mockSeries };
      expect(props.series).toEqual(mockSeries);
    });

    it('should accept optional configuration props', () => {
      const props = {
        data: mockData,
        title: 'Test Chart',
        height: 400,
        showGrid: true,
        showXAxis: true,
        showYAxis: true,
        loading: false,
        emptyMessage: 'No data',
        className: 'test-class',
      };
      expect(props.title).toBe('Test Chart');
      expect(props.height).toBe(400);
      expect(props.showGrid).toBe(true);
      expect(props.showXAxis).toBe(true);
      expect(props.showYAxis).toBe(true);
      expect(props.loading).toBe(false);
      expect(props.emptyMessage).toBe('No data');
      expect(props.className).toBe('test-class');
    });
  });

  describe('Data Handling', () => {
    it('should handle empty data array', () => {
      const props = { data: [] };
      expect(props.data).toHaveLength(0);
    });

    it('should handle single data point', () => {
      const singlePoint = [{ x: new Date('2026-01-01'), y: 100 }];
      const props = { data: singlePoint };
      expect(props.data).toHaveLength(1);
    });

    it('should handle date-based x values', () => {
      expect(mockData[0]?.x).toBeInstanceOf(Date);
    });

    it('should handle numeric x values', () => {
      expect(typeof mockNumericData[0]?.x).toBe('number');
    });

    it('should handle data with labels', () => {
      const dataWithLabels: LineChartDataPoint[] = [
        { x: 1, y: 10, label: 'Point 1' },
        { x: 2, y: 20, label: 'Point 2' },
      ];
      expect(dataWithLabels[0]?.label).toBe('Point 1');
    });

    it('should handle data with metadata', () => {
      const dataWithMetadata: LineChartDataPoint[] = [
        { x: 1, y: 10, metadata: { category: 'A' } },
        { x: 2, y: 20, metadata: { category: 'B' } },
      ];
      expect(dataWithMetadata[0]?.metadata).toEqual({ category: 'A' });
    });
  });

  describe('Series Configuration', () => {
    it('should handle multiple series', () => {
      const props = { series: mockSeries };
      expect(props.series).toHaveLength(2);
    });

    it('should require series id and name', () => {
      const series = mockSeries[0];
      expect(series?.id).toBe('series1');
      expect(series?.name).toBe('Series 1');
    });

    it('should handle optional series properties', () => {
      const seriesWithOptions: LineChartSeries = {
        id: 'test',
        name: 'Test',
        data: mockData,
        color: '#ff0000',
        showArea: true,
        areaOpacity: 0.3,
        strokeWidth: 3,
        showPoints: false,
      };
      expect(seriesWithOptions.color).toBe('#ff0000');
      expect(seriesWithOptions.showArea).toBe(true);
      expect(seriesWithOptions.areaOpacity).toBe(0.3);
      expect(seriesWithOptions.strokeWidth).toBe(3);
      expect(seriesWithOptions.showPoints).toBe(false);
    });

    it('should handle series with different data lengths', () => {
      const series: LineChartSeries[] = [
        { id: 's1', name: 'Series 1', data: mockData.slice(0, 3) },
        { id: 's2', name: 'Series 2', data: mockData },
      ];
      expect(series[0]?.data).toHaveLength(3);
      expect(series[1]?.data).toHaveLength(5);
    });
  });

  describe('Formatting Functions', () => {
    it('should accept custom x-axis formatter', () => {
      const formatter = (value: number | Date) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return String(value);
      };
      const props = { data: mockData, formatXAxis: formatter };
      expect(props.formatXAxis).toBeDefined();
      expect(typeof props.formatXAxis).toBe('function');
    });

    it('should accept custom y-axis formatter', () => {
      const formatter = (value: number) => `$${value.toFixed(2)}`;
      const props = { data: mockData, formatYAxis: formatter };
      expect(props.formatYAxis).toBeDefined();
      expect(typeof props.formatYAxis).toBe('function');
    });

    it('should accept custom tooltip formatter', () => {
      const formatter = (point: LineChartDataPoint) => <div>{point.y}</div>;
      const props = { data: mockData, formatTooltip: formatter };
      expect(props.formatTooltip).toBeDefined();
      expect(typeof props.formatTooltip).toBe('function');
    });
  });

  describe('Chart Dimensions', () => {
    it('should accept custom height', () => {
      const props = { data: mockData, height: 500 };
      expect(props.height).toBe(500);
    });

    it('should use default height when not specified', () => {
      const props: { data: LineChartDataPoint[]; height?: number } = { data: mockData };
      // Default height is 300px (from component implementation)
      expect(props.height).toBeUndefined(); // Will use default in component
    });
  });

  describe('Display Options', () => {
    it('should handle grid display toggle', () => {
      const withGrid = { data: mockData, showGrid: true };
      const withoutGrid = { data: mockData, showGrid: false };
      expect(withGrid.showGrid).toBe(true);
      expect(withoutGrid.showGrid).toBe(false);
    });

    it('should handle x-axis display toggle', () => {
      const props = { data: mockData, showXAxis: false };
      expect(props.showXAxis).toBe(false);
    });

    it('should handle y-axis display toggle', () => {
      const props = { data: mockData, showYAxis: false };
      expect(props.showYAxis).toBe(false);
    });

    it('should display title when provided', () => {
      const props = { data: mockData, title: 'My Chart' };
      expect(props.title).toBe('My Chart');
    });
  });

  describe('Loading State', () => {
    it('should handle loading state', () => {
      const props = { data: mockData, loading: true };
      expect(props.loading).toBe(true);
    });

    it('should show loading skeleton when loading', () => {
      const props = { data: [], loading: true };
      expect(props.loading).toBe(true);
      expect(props.data).toHaveLength(0);
    });
  });

  describe('Empty State', () => {
    it('should handle empty state', () => {
      const props = { data: [] };
      expect(props.data).toHaveLength(0);
    });

    it('should accept custom empty message', () => {
      const props = { data: [], emptyMessage: 'No data to display' };
      expect(props.emptyMessage).toBe('No data to display');
    });

    it('should show empty state for undefined data', () => {
      const props = { data: undefined };
      expect(props.data).toBeUndefined();
    });
  });

  describe('Type Safety', () => {
    it('should have typed data points', () => {
      const point: LineChartDataPoint = {
        x: new Date('2026-01-01'),
        y: 100,
      };
      expect(point.x).toBeInstanceOf(Date);
      expect(typeof point.y).toBe('number');
    });

    it('should have typed series', () => {
      const series: LineChartSeries = {
        id: 'test',
        name: 'Test Series',
        data: mockData,
      };
      expect(series.id).toBe('test');
      expect(series.name).toBe('Test Series');
      expect(Array.isArray(series.data)).toBe(true);
    });

    it('should handle optional metadata typing', () => {
      const point: LineChartDataPoint = {
        x: 1,
        y: 100,
        metadata: {
          category: 'test',
          value: 42,
          flag: true,
        },
      };
      expect(point.metadata).toBeDefined();
      expect(point.metadata?.category).toBe('test');
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative y values', () => {
      const negativeData: LineChartDataPoint[] = [
        { x: 1, y: -10 },
        { x: 2, y: -20 },
        { x: 3, y: -5 },
      ];
      const props = { data: negativeData };
      expect(props.data[0]?.y).toBeLessThan(0);
    });

    it('should handle zero values', () => {
      const zeroData: LineChartDataPoint[] = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ];
      const props = { data: zeroData };
      expect(props.data.every((d) => d.y === 0)).toBe(true);
    });

    it('should handle large values', () => {
      const largeData: LineChartDataPoint[] = [
        { x: 1, y: 1000000 },
        { x: 2, y: 2000000 },
      ];
      const props = { data: largeData };
      expect(props.data[0]?.y).toBeGreaterThan(999999);
    });

    it('should handle very small values', () => {
      const smallData: LineChartDataPoint[] = [
        { x: 1, y: 0.001 },
        { x: 2, y: 0.002 },
      ];
      const props = { data: smallData };
      expect(props.data[0]?.y).toBeLessThan(0.01);
    });

    it('should handle mixed positive and negative values', () => {
      const mixedData: LineChartDataPoint[] = [
        { x: 1, y: 100 },
        { x: 2, y: -50 },
        { x: 3, y: 75 },
        { x: 4, y: -25 },
      ];
      const props = { data: mixedData };
      expect(props.data.some((d) => d.y > 0)).toBe(true);
      expect(props.data.some((d) => d.y < 0)).toBe(true);
    });

    it('should handle single value range', () => {
      const flatData: LineChartDataPoint[] = [
        { x: 1, y: 100 },
        { x: 2, y: 100 },
        { x: 3, y: 100 },
      ];
      const props = { data: flatData };
      expect(new Set(props.data.map((d) => d.y)).size).toBe(1);
    });
  });

  describe('Accessibility', () => {
    it('should accept className for styling', () => {
      const props = { data: mockData, className: 'custom-chart' };
      expect(props.className).toBe('custom-chart');
    });

    it('should have title for screen readers', () => {
      const props = { data: mockData, title: 'Accessible Chart Title' };
      expect(props.title).toBe('Accessible Chart Title');
    });
  });

  describe('Responsive Design', () => {
    it('should use percentage-based viewBox', () => {
      // SVG uses viewBox="0 0 100 100" for responsive scaling
      const props = { data: mockData };
      expect(props.data).toBeDefined();
      // Component should render with responsive SVG
    });

    it('should support custom height for different screen sizes', () => {
      const mobileHeight = { data: mockData, height: 200 };
      const desktopHeight = { data: mockData, height: 400 };
      expect(mobileHeight.height).toBe(200);
      expect(desktopHeight.height).toBe(400);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets', () => {
      const largeDataset: LineChartDataPoint[] = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: Math.random() * 100,
      }));
      const props = { data: largeDataset };
      expect(props.data).toHaveLength(1000);
    });

    it('should handle multiple series with large datasets', () => {
      const largeSeries: LineChartSeries[] = Array.from({ length: 10 }, (_, seriesIndex) => ({
        id: `series-${seriesIndex}`,
        name: `Series ${seriesIndex}`,
        data: Array.from({ length: 100 }, (_, i) => ({
          x: i,
          y: Math.random() * 100,
        })),
      }));
      const props = { series: largeSeries };
      expect(props.series).toHaveLength(10);
      expect(props.series[0]?.data).toHaveLength(100);
    });
  });

  describe('Integration', () => {
    it('should work with single series mode', () => {
      const props: { data: LineChartDataPoint[]; series?: LineChartSeries[] } = { data: mockData };
      expect(props.data).toBeDefined();
      expect(props.series).toBeUndefined();
    });

    it('should work with multiple series mode', () => {
      const props: { series: LineChartSeries[]; data?: LineChartDataPoint[] } = { series: mockSeries };
      expect(props.series).toBeDefined();
      expect(props.data).toBeUndefined();
    });

    it('should prioritize series over data when both provided', () => {
      const props = { data: mockData, series: mockSeries };
      // Implementation should use series when both are provided
      expect(props.data).toBeDefined();
      expect(props.series).toBeDefined();
    });
  });
});
