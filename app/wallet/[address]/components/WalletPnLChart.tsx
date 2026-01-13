'use client';

import { useState, useMemo } from 'react';

/**
 * Time range options for the P&L chart
 */
export type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

/**
 * P&L data point interface
 */
export interface PnLDataPoint {
  timestamp: Date;
  cumulativePnL: number;
  dailyPnL: number;
}

/**
 * WalletPnLChart Props
 */
export interface WalletPnLChartProps {
  /** Historical P&L data points */
  data: PnLDataPoint[];
  /** Optional chart title */
  title?: string;
  /** Show time range selector */
  showTimeRangeSelector?: boolean;
}

/**
 * Get time range in milliseconds
 */
function getTimeRangeMs(range: TimeRange): number {
  switch (range) {
    case '1D':
      return 24 * 60 * 60 * 1000; // 1 day
    case '1W':
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    case '1M':
      return 30 * 24 * 60 * 60 * 1000; // 30 days
    case '3M':
      return 90 * 24 * 60 * 60 * 1000; // 90 days
    case '1Y':
      return 365 * 24 * 60 * 60 * 1000; // 365 days
    case 'ALL':
      return Infinity;
  }
}

/**
 * Format number as currency
 */
function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (absValue >= 1000) {
    return `$${(value / 1000).toFixed(2)}k`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format date for display
 */
function formatDate(date: Date, range: TimeRange): string {
  if (range === '1D') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (range === '1W' || range === '1M') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/**
 * Wallet P&L Chart Component
 *
 * Displays cumulative profit/loss over time with:
 * - Line chart visualization
 * - Time range selector
 * - Profit/loss zones with color coding
 * - Interactive tooltips
 */
export function WalletPnLChart({
  data,
  title = 'Profit & Loss Over Time',
  showTimeRangeSelector = true,
}: WalletPnLChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('ALL');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter data by time range
  const filteredData = useMemo(() => {
    if (selectedRange === 'ALL') return data;

    const rangeMs = getTimeRangeMs(selectedRange);
    const cutoffTime = Date.now() - rangeMs;

    return data.filter((point) => point.timestamp.getTime() >= cutoffTime);
  }, [data, selectedRange]);

  // Calculate chart dimensions and scales
  const chartDimensions = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        minPnL: 0,
        maxPnL: 0,
        range: 0,
        points: [],
      };
    }

    const pnlValues = filteredData.map((d) => d.cumulativePnL);
    const minPnL = Math.min(...pnlValues, 0);
    const maxPnL = Math.max(...pnlValues, 0);
    const range = maxPnL - minPnL || 1; // Avoid division by zero

    // Calculate chart points (x, y coordinates)
    const chartWidth = 100; // percentage
    const chartHeight = 100; // percentage
    const points = filteredData.map((point, index) => {
      const x = (index / (filteredData.length - 1 || 1)) * chartWidth;
      const y = chartHeight - ((point.cumulativePnL - minPnL) / range) * chartHeight;
      return { x, y, data: point };
    });

    return { minPnL, maxPnL, range, points };
  }, [filteredData]);

  // Generate SVG path for the P&L line
  const linePath = useMemo(() => {
    if (chartDimensions.points.length === 0) return '';

    return chartDimensions.points
      .map((point, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${command} ${point.x} ${point.y}`;
      })
      .join(' ');
  }, [chartDimensions.points]);

  // Generate area path for profit/loss zones
  const areaPath = useMemo(() => {
    if (chartDimensions.points.length === 0) return '';

    const { minPnL, range } = chartDimensions;
    const zeroY = 100 - ((0 - minPnL) / range) * 100;

    const points = chartDimensions.points;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    if (!firstPoint || !lastPoint) return '';

    // Create closed path for area fill
    const linePart = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const closePart = `L ${lastPoint.x} ${zeroY} L ${firstPoint.x} ${zeroY} Z`;

    return linePart + ' ' + closePart;
  }, [chartDimensions]);

  // Calculate final P&L and change
  const finalPnL = filteredData[filteredData.length - 1]?.cumulativePnL ?? 0;
  const initialPnL = filteredData[0]?.cumulativePnL ?? 0;
  const changePnL = finalPnL - initialPnL;
  const changePercent =
    initialPnL !== 0 ? ((changePnL / Math.abs(initialPnL)) * 100).toFixed(2) : '0.00';

  const timeRanges: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-bold ${
                finalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatCurrency(finalPnL)}
            </span>
            <span
              className={`text-sm ${
                changePnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {changePnL >= 0 ? '+' : ''}
              {formatCurrency(changePnL)} ({changePnL >= 0 ? '+' : ''}
              {changePercent}%)
            </span>
          </div>
        </div>

        {/* Time range selector */}
        {showTimeRangeSelector && (
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  selectedRange === range
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative">
        {filteredData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            No P&L data available for this time range
          </div>
        ) : (
          <div className="relative h-64">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Zero line */}
              <line
                x1="0"
                x2="100"
                y1={100 - ((0 - chartDimensions.minPnL) / chartDimensions.range) * 100}
                y2={100 - ((0 - chartDimensions.minPnL) / chartDimensions.range) * 100}
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-gray-400 dark:text-gray-600"
                strokeDasharray="1,1"
                vectorEffect="non-scaling-stroke"
              />

              {/* Area fill (profit/loss zones) */}
              <path
                d={areaPath}
                fill="currentColor"
                className={
                  finalPnL >= 0
                    ? 'text-green-500/20 dark:text-green-400/20'
                    : 'text-red-500/20 dark:text-red-400/20'
                }
              />

              {/* P&L line */}
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className={
                  finalPnL >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }
                vectorEffect="non-scaling-stroke"
              />

              {/* Data points */}
              {chartDimensions.points.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={hoveredIndex === index ? '1' : '0.5'}
                  fill="currentColor"
                  className={
                    finalPnL >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => setHoveredIndex(index)}
                  style={{ cursor: 'pointer' }}
                />
              ))}

              {/* Invisible overlay for better hover detection */}
              {chartDimensions.points.map((point, index) => (
                <rect
                  key={`overlay-${index}`}
                  x={point.x - 2}
                  y="0"
                  width="4"
                  height="100"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </svg>

            {/* Tooltip */}
            {hoveredIndex !== null &&
              hoveredIndex >= 0 &&
              hoveredIndex < chartDimensions.points.length &&
              chartDimensions.points[hoveredIndex] && (
                <div
                  className="absolute bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 shadow-lg pointer-events-none z-10"
                  style={{
                    left: `${chartDimensions.points[hoveredIndex]!.x}%`,
                    top: `${chartDimensions.points[hoveredIndex]!.y}%`,
                    transform: 'translate(-50%, -120%)',
                  }}
                >
                  <div className="font-semibold">
                    {formatCurrency(chartDimensions.points[hoveredIndex]!.data.cumulativePnL)}
                  </div>
                  <div className="text-gray-300 dark:text-gray-400">
                    {formatDate(
                      chartDimensions.points[hoveredIndex]!.data.timestamp,
                      selectedRange,
                    )}
                  </div>
                  <div
                    className={
                      chartDimensions.points[hoveredIndex]!.data.dailyPnL >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }
                  >
                    Daily: {formatCurrency(chartDimensions.points[hoveredIndex]!.data.dailyPnL)}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 -ml-16 w-14 text-right">
          <span>{formatCurrency(chartDimensions.maxPnL)}</span>
          <span className="text-gray-400 dark:text-gray-600">$0</span>
          <span>{formatCurrency(chartDimensions.minPnL)}</span>
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          {filteredData.length > 0 && filteredData[0] && filteredData[filteredData.length - 1] && (
            <>
              <span>{formatDate(filteredData[0].timestamp, selectedRange)}</span>
              <span>
                {formatDate(filteredData[filteredData.length - 1]!.timestamp, selectedRange)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
