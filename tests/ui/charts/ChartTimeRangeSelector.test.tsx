import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ChartTimeRangeSelector,
  timeRangeToMs,
  timeRangeToDays,
  getCutoffDate,
  filterDataByTimeRange,
  CustomTimeRange,
} from '@/app/components/charts/ChartTimeRangeSelector';

describe('ChartTimeRangeSelector', () => {
  describe('Component Rendering', () => {
    it('should render all available time ranges', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          availableRanges={['1D', '1W', '1M', '3M', '6M', 'ALL']}
        />
      );

      expect(screen.getByText('1D')).toBeInTheDocument();
      expect(screen.getByText('1W')).toBeInTheDocument();
      expect(screen.getByText('1M')).toBeInTheDocument();
      expect(screen.getByText('3M')).toBeInTheDocument();
      expect(screen.getByText('6M')).toBeInTheDocument();
      expect(screen.getByText('ALL')).toBeInTheDocument();
    });

    it('should highlight the selected range', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1W"
          onRangeChange={onRangeChange}
          availableRanges={['1D', '1W', '1M']}
        />
      );

      const selectedButton = screen.getByText('1W');
      expect(selectedButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should render only specified available ranges', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1D"
          onRangeChange={onRangeChange}
          availableRanges={['1D', '1W']}
        />
      );

      expect(screen.getByText('1D')).toBeInTheDocument();
      expect(screen.getByText('1W')).toBeInTheDocument();
      expect(screen.queryByText('1M')).not.toBeInTheDocument();
      expect(screen.queryByText('3M')).not.toBeInTheDocument();
    });

    it('should render custom range button when enabled', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          enableCustomRange={true}
        />
      );

      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('should not render custom range button by default', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
        />
      );

      expect(screen.queryByText('Custom')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const onRangeChange = vi.fn();
      const { container } = render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          className="my-custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          availableRanges={['1M']}
          size="sm"
        />
      );

      const button = screen.getByText('1M');
      expect(button).toHaveClass('px-2', 'py-0.5', 'text-xs');
    });

    it('should apply medium size classes by default', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          availableRanges={['1M']}
        />
      );

      const button = screen.getByText('1M');
      expect(button).toHaveClass('px-3', 'py-1', 'text-sm');
    });

    it('should apply large size classes', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          availableRanges={['1M']}
          size="lg"
        />
      );

      const button = screen.getByText('1M');
      expect(button).toHaveClass('px-4', 'py-2', 'text-base');
    });
  });

  describe('Interaction', () => {
    it('should call onRangeChange when a range button is clicked', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          availableRanges={['1D', '1W', '1M']}
        />
      );

      fireEvent.click(screen.getByText('1W'));
      expect(onRangeChange).toHaveBeenCalledWith('1W');
      expect(onRangeChange).toHaveBeenCalledTimes(1);
    });

    it('should call onCustomRangeChange when custom button is clicked', () => {
      const onRangeChange = vi.fn();
      const onCustomRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          enableCustomRange={true}
          onCustomRangeChange={onCustomRangeChange}
        />
      );

      fireEvent.click(screen.getByText('Custom'));
      expect(onCustomRangeChange).toHaveBeenCalledTimes(1);
      expect(onCustomRangeChange).toHaveBeenCalledWith(
        expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date),
        })
      );
    });

    it('should show custom range dates when custom range is set', () => {
      const onRangeChange = vi.fn();
      const customRange: CustomTimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          enableCustomRange={true}
          customRange={customRange}
        />
      );

      expect(screen.getByText(/Jan 1/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 31/)).toBeInTheDocument();
    });

    it('should highlight custom button when custom range is set', () => {
      const onRangeChange = vi.fn();
      const customRange: CustomTimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          enableCustomRange={true}
          customRange={customRange}
        />
      );

      const customButton = screen.getByText('Custom');
      expect(customButton).toHaveClass('bg-blue-600', 'text-white');

      // Preset ranges should not be highlighted
      const presetButton = screen.getByText('1M');
      expect(presetButton).not.toHaveClass('bg-blue-600', 'text-white');
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          availableRanges={['1D', '1W', '1M']}
        />
      );

      expect(screen.getByLabelText('Select 1D time range')).toBeInTheDocument();
      expect(screen.getByLabelText('Select 1W time range')).toBeInTheDocument();
      expect(screen.getByLabelText('Select 1M time range')).toBeInTheDocument();
    });

    it('should have aria-pressed on selected button', () => {
      const onRangeChange = vi.fn();
      render(
        <ChartTimeRangeSelector
          selectedRange="1W"
          onRangeChange={onRangeChange}
          availableRanges={['1D', '1W', '1M']}
        />
      );

      const selectedButton = screen.getByText('1W');
      expect(selectedButton).toHaveAttribute('aria-pressed', 'true');

      const unselectedButton = screen.getByText('1D');
      expect(unselectedButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have title on custom button showing date range', () => {
      const onRangeChange = vi.fn();
      const customRange: CustomTimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      render(
        <ChartTimeRangeSelector
          selectedRange="1M"
          onRangeChange={onRangeChange}
          enableCustomRange={true}
          customRange={customRange}
        />
      );

      const customButton = screen.getByText('Custom');
      expect(customButton).toHaveAttribute('title');
      const title = customButton.getAttribute('title');
      expect(title).toContain('1/1/2024');
      expect(title).toContain('31/1/2024'); // Date format may vary by locale
    });
  });
});

describe('Utility Functions', () => {
  describe('timeRangeToMs', () => {
    it('should convert 1H to milliseconds', () => {
      expect(timeRangeToMs('1H')).toBe(60 * 60 * 1000);
    });

    it('should convert 1D to milliseconds', () => {
      expect(timeRangeToMs('1D')).toBe(24 * 60 * 60 * 1000);
    });

    it('should convert 1W to milliseconds', () => {
      expect(timeRangeToMs('1W')).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should convert 1M to milliseconds', () => {
      expect(timeRangeToMs('1M')).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should convert 3M to milliseconds', () => {
      expect(timeRangeToMs('3M')).toBe(90 * 24 * 60 * 60 * 1000);
    });

    it('should convert 6M to milliseconds', () => {
      expect(timeRangeToMs('6M')).toBe(180 * 24 * 60 * 60 * 1000);
    });

    it('should convert 1Y to milliseconds', () => {
      expect(timeRangeToMs('1Y')).toBe(365 * 24 * 60 * 60 * 1000);
    });

    it('should convert ALL to Infinity', () => {
      expect(timeRangeToMs('ALL')).toBe(Infinity);
    });
  });

  describe('timeRangeToDays', () => {
    it('should convert 1H to fractional days', () => {
      expect(timeRangeToDays('1H')).toBe(1 / 24);
    });

    it('should convert 1D to days', () => {
      expect(timeRangeToDays('1D')).toBe(1);
    });

    it('should convert 1W to days', () => {
      expect(timeRangeToDays('1W')).toBe(7);
    });

    it('should convert 1M to days', () => {
      expect(timeRangeToDays('1M')).toBe(30);
    });

    it('should convert 3M to days', () => {
      expect(timeRangeToDays('3M')).toBe(90);
    });

    it('should convert 6M to days', () => {
      expect(timeRangeToDays('6M')).toBe(180);
    });

    it('should convert 1Y to days', () => {
      expect(timeRangeToDays('1Y')).toBe(365);
    });

    it('should convert ALL to Infinity', () => {
      expect(timeRangeToDays('ALL')).toBe(Infinity);
    });
  });

  describe('getCutoffDate', () => {
    it('should calculate cutoff date for 1D range', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const cutoff = getCutoffDate('1D', now);
      expect(cutoff.getTime()).toBe(now.getTime() - 24 * 60 * 60 * 1000);
    });

    it('should calculate cutoff date for 1W range', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const cutoff = getCutoffDate('1W', now);
      expect(cutoff.getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    });

    it('should calculate cutoff date for 1M range', () => {
      const now = new Date('2024-01-31T12:00:00Z');
      const cutoff = getCutoffDate('1M', now);
      expect(cutoff.getTime()).toBe(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    });

    it('should return epoch for ALL range', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const cutoff = getCutoffDate('ALL', now);
      expect(cutoff.getTime()).toBe(0);
    });

    it('should use current date if now is not provided', () => {
      const before = Date.now();
      const cutoff = getCutoffDate('1D');
      const after = Date.now();

      const expectedMin = before - 24 * 60 * 60 * 1000;
      const expectedMax = after - 24 * 60 * 60 * 1000;

      expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('filterDataByTimeRange', () => {
    const testData = [
      { timestamp: new Date('2024-01-01T12:00:00Z'), value: 1 },
      { timestamp: new Date('2024-01-05T12:00:00Z'), value: 2 },
      { timestamp: new Date('2024-01-10T12:00:00Z'), value: 3 },
      { timestamp: new Date('2024-01-15T12:00:00Z'), value: 4 },
      { timestamp: new Date('2024-01-20T12:00:00Z'), value: 5 },
      { timestamp: new Date('2024-01-25T12:00:00Z'), value: 6 },
    ];

    it('should filter data by 1W range', () => {
      const now = new Date('2024-01-27T12:00:00Z');
      const filtered = filterDataByTimeRange(testData, '1W', undefined, now);

      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.value).toBe(5);
      expect(filtered[1]?.value).toBe(6);
    });

    it('should filter data by 1M range', () => {
      const now = new Date('2024-01-27T12:00:00Z');
      const filtered = filterDataByTimeRange(testData, '1M', undefined, now);

      expect(filtered).toHaveLength(6); // All data within 30 days
    });

    it('should return all data for ALL range', () => {
      const now = new Date('2024-01-27T12:00:00Z');
      const filtered = filterDataByTimeRange(testData, 'ALL', undefined, now);

      expect(filtered).toHaveLength(6);
    });

    it('should filter by custom range when provided', () => {
      const customRange: CustomTimeRange = {
        start: new Date('2024-01-08T00:00:00Z'),
        end: new Date('2024-01-18T00:00:00Z'),
      };

      const filtered = filterDataByTimeRange(testData, '1M', customRange);

      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.value).toBe(3);
      expect(filtered[1]?.value).toBe(4);
    });

    it('should handle empty data array', () => {
      const filtered = filterDataByTimeRange([], '1M');
      expect(filtered).toHaveLength(0);
    });

    it('should handle data with no matches', () => {
      const now = new Date('2024-02-27T12:00:00Z');
      const filtered = filterDataByTimeRange(testData, '1W', undefined, now);
      expect(filtered).toHaveLength(0);
    });
  });
});
