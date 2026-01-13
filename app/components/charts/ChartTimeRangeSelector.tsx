'use client';

import { useState } from 'react';

/**
 * Common time range options for charts
 */
export type TimeRange = '1H' | '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

/**
 * Convert time range to milliseconds
 */
export function timeRangeToMs(range: TimeRange): number {
  const MS_PER_HOUR = 60 * 60 * 1000;
  const MS_PER_DAY = 24 * MS_PER_HOUR;

  const ranges: Record<TimeRange, number> = {
    '1H': MS_PER_HOUR,
    '1D': MS_PER_DAY,
    '1W': 7 * MS_PER_DAY,
    '1M': 30 * MS_PER_DAY,
    '3M': 90 * MS_PER_DAY,
    '6M': 180 * MS_PER_DAY,
    '1Y': 365 * MS_PER_DAY,
    'ALL': Infinity,
  };

  return ranges[range];
}

/**
 * Convert time range to days
 */
export function timeRangeToDays(range: TimeRange): number {
  if (range === '1H') return 1 / 24;
  if (range === 'ALL') return Infinity;

  const ranges: Record<Exclude<TimeRange, '1H' | 'ALL'>, number> = {
    '1D': 1,
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
  };

  return ranges[range];
}

/**
 * Get cutoff date for a time range
 */
export function getCutoffDate(range: TimeRange, now = new Date()): Date {
  if (range === 'ALL') {
    return new Date(0); // Beginning of time
  }

  const ms = timeRangeToMs(range);
  return new Date(now.getTime() - ms);
}

/**
 * Custom time range configuration
 */
export interface CustomTimeRange {
  start: Date;
  end: Date;
}

/**
 * Props for ChartTimeRangeSelector component
 */
export interface ChartTimeRangeSelectorProps {
  /** Currently selected time range */
  selectedRange: TimeRange;
  /** Callback when time range changes */
  onRangeChange: (range: TimeRange) => void;
  /** Available time range options (defaults to all) */
  availableRanges?: TimeRange[];
  /** Enable custom date range picker */
  enableCustomRange?: boolean;
  /** Custom range if set */
  customRange?: CustomTimeRange;
  /** Callback when custom range changes */
  onCustomRangeChange?: (range: CustomTimeRange) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

/**
 * ChartTimeRangeSelector Component
 *
 * Reusable time range selector for charts with preset ranges (1H, 1D, 1W, 1M, etc.)
 * and optional custom date range picker.
 *
 * Features:
 * - Preset time ranges (1H, 1D, 1W, 1M, 3M, 6M, 1Y, ALL)
 * - Configurable available ranges
 * - Optional custom date range picker
 * - Multiple size variants
 * - Responsive design
 * - Dark mode support
 *
 * @example
 * ```tsx
 * const [range, setRange] = useState<TimeRange>('1M');
 *
 * <ChartTimeRangeSelector
 *   selectedRange={range}
 *   onRangeChange={setRange}
 *   availableRanges={['1D', '1W', '1M', '3M', '6M', 'ALL']}
 * />
 * ```
 */
export function ChartTimeRangeSelector({
  selectedRange,
  onRangeChange,
  availableRanges = ['1H', '1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'],
  enableCustomRange = false,
  customRange,
  onCustomRangeChange,
  size = 'md',
  className = '',
}: ChartTimeRangeSelectorProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const buttonClass = sizeClasses[size];
  const isCustomSelected = customRange !== undefined;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Preset ranges */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {availableRanges.map((range) => (
          <button
            key={range}
            onClick={() => onRangeChange(range)}
            className={`${buttonClass} font-medium rounded transition-colors ${
              selectedRange === range && !isCustomSelected
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
            aria-label={`Select ${range} time range`}
            aria-pressed={selectedRange === range && !isCustomSelected}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Custom range picker */}
      {enableCustomRange && (
        <button
          onClick={() => {
            // TODO: Open date picker modal
            // For now, just show placeholder
            if (onCustomRangeChange) {
              const end = new Date();
              const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
              onCustomRangeChange({ start, end });
            }
          }}
          className={`${buttonClass} font-medium rounded border-2 transition-colors ${
            isCustomSelected
              ? 'bg-blue-600 text-white border-blue-600'
              : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          aria-label="Select custom date range"
          aria-pressed={isCustomSelected}
          title={
            customRange
              ? `${customRange.start.toLocaleDateString()} - ${customRange.end.toLocaleDateString()}`
              : 'Custom range'
          }
        >
          Custom
        </button>
      )}

      {/* Custom range display */}
      {isCustomSelected && customRange && (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {customRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' - '}
          {customRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
    </div>
  );
}

/**
 * Filter data points by time range
 */
export function filterDataByTimeRange<T extends { timestamp: Date }>(
  data: T[],
  range: TimeRange,
  customRange?: CustomTimeRange,
  now = new Date()
): T[] {
  if (customRange) {
    return data.filter(
      (point) => point.timestamp >= customRange.start && point.timestamp <= customRange.end
    );
  }

  const cutoff = getCutoffDate(range, now);
  return data.filter((point) => point.timestamp >= cutoff);
}

/**
 * Hook for managing chart time range state
 */
export function useChartTimeRange(
  initialRange: TimeRange = '1M',
  initialCustomRange?: CustomTimeRange
) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>(initialRange);
  const [customRange, setCustomRange] = useState<CustomTimeRange | undefined>(initialCustomRange);

  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range);
    setCustomRange(undefined); // Clear custom range when preset is selected
  };

  const handleCustomRangeChange = (range: CustomTimeRange) => {
    setCustomRange(range);
    // selectedRange remains set but is overridden by custom range
  };

  const filterData = <T extends { timestamp: Date }>(data: T[], now = new Date()): T[] => {
    return filterDataByTimeRange(data, selectedRange, customRange, now);
  };

  return {
    selectedRange,
    customRange,
    handleRangeChange,
    handleCustomRangeChange,
    filterData,
  };
}
