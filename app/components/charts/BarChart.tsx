'use client';

import { useState, useMemo } from 'react';

/**
 * Data point for bar chart
 */
export interface BarChartDataPoint {
  /** X-axis label/category */
  label: string;
  /** Y-axis value */
  value: number;
  /** Optional color override */
  color?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Series configuration for stacked bar charts
 */
export interface BarChartSeries {
  /** Unique identifier for the series */
  id: string;
  /** Display name for the series */
  name: string;
  /** Data points for this series */
  data: BarChartDataPoint[];
  /** Bar color (CSS color string) */
  color?: string;
}

/**
 * BarChart component props
 */
export interface BarChartProps {
  /** Single series data (simple mode) */
  data?: BarChartDataPoint[];
  /** Multiple series data (stacked mode) */
  series?: BarChartSeries[];
  /** Chart title */
  title?: string;
  /** Chart height in pixels */
  height?: number;
  /** Show grid lines */
  showGrid?: boolean;
  /** Show X-axis labels */
  showXAxis?: boolean;
  /** Show Y-axis labels */
  showYAxis?: boolean;
  /** Y-axis label formatter */
  formatYAxis?: (value: number) => string;
  /** Tooltip content formatter */
  formatTooltip?: (point: BarChartDataPoint, series?: BarChartSeries, total?: number) => React.ReactNode;
  /** Whether chart is loading */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Whether to stack bars */
  stacked?: boolean;
  /** Bar spacing (0-1) */
  barSpacing?: number;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Default color palette for multiple series
 */
const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

/**
 * Format number as abbreviated string
 */
function formatNumber(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (absValue >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

/**
 * Default Y-axis formatter
 */
function defaultFormatYAxis(value: number): string {
  return formatNumber(value);
}

/**
 * Convert series to normalized format
 */
function normalizeSeries(
  data?: BarChartDataPoint[],
  series?: BarChartSeries[],
): BarChartSeries[] {
  if (series && series.length > 0) {
    return series.map((s, index) => ({
      ...s,
      color: s.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      data: s.data.map((point) => ({
        ...point,
        color: point.color || s.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      })),
    }));
  }

  if (data && data.length > 0) {
    return [
      {
        id: 'default',
        name: 'Value',
        color: DEFAULT_COLORS[0],
        data: data.map((point) => ({
          ...point,
          color: point.color || DEFAULT_COLORS[0],
        })),
      },
    ];
  }

  return [];
}

/**
 * Reusable Bar Chart Component
 *
 * Features:
 * - Single or multiple series support
 * - Stacked bars support
 * - Responsive sizing
 * - Interactive tooltips
 * - Grid lines
 * - Axis labels
 * - Loading state
 * - Empty state
 */
export function BarChart({
  data,
  series,
  title,
  height = 300,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  formatYAxis = defaultFormatYAxis,
  formatTooltip,
  loading = false,
  emptyMessage = 'No data available',
  stacked = false,
  barSpacing = 0.2,
  className = '',
}: BarChartProps) {
  const [hoveredBar, setHoveredBar] = useState<{
    seriesId: string;
    barIndex: number;
  } | null>(null);

  // Normalize series data
  const normalizedSeries = useMemo(() => normalizeSeries(data, series), [data, series]);

  // Calculate chart dimensions and scales
  const chartDimensions = useMemo(() => {
    if (normalizedSeries.length === 0) {
      return {
        minY: 0,
        maxY: 0,
        rangeY: 1,
        labels: [],
        barCount: 0,
      };
    }

    // Get all unique labels
    const labelsSet = new Set<string>();
    normalizedSeries.forEach((s) => {
      s.data.forEach((point) => labelsSet.add(point.label));
    });
    const labels = Array.from(labelsSet);

    if (labels.length === 0) {
      return {
        minY: 0,
        maxY: 0,
        rangeY: 1,
        labels: [],
        barCount: 0,
      };
    }

    // Calculate max value
    let maxY: number;
    if (stacked) {
      // For stacked bars, sum values for each label
      maxY = Math.max(
        ...labels.map((label) => {
          return normalizedSeries.reduce((sum, s) => {
            const point = s.data.find((p) => p.label === label);
            return sum + (point?.value || 0);
          }, 0);
        }),
      );
    } else {
      // For grouped bars, find max individual value
      maxY = Math.max(
        ...normalizedSeries.flatMap((s) => s.data.map((point) => point.value)),
      );
    }

    const minY = Math.min(
      0,
      ...normalizedSeries.flatMap((s) => s.data.map((point) => point.value)),
    );

    const rangeY = maxY - minY || 1;

    return { minY, maxY, rangeY, labels, barCount: labels.length };
  }, [normalizedSeries, stacked]);

  // Calculate grid lines
  const gridLines = useMemo(() => {
    const yLines = 5;
    const yStep = 100 / yLines;

    return {
      horizontal: Array.from({ length: yLines + 1 }, (_, i) => i * yStep),
    };
  }, []);

  // Calculate axis labels
  const axisLabels = useMemo(() => {
    const yLabels = 5;
    const yStep = chartDimensions.rangeY / yLabels;

    return {
      y: Array.from({ length: yLabels + 1 }, (_, i) => {
        const value = chartDimensions.minY + i * yStep;
        return { value, label: formatYAxis(value), position: (i * 100) / yLabels };
      }),
    };
  }, [chartDimensions, formatYAxis]);

  // Calculate bar positions and heights
  const bars = useMemo(() => {
    const { labels, barCount } = chartDimensions;
    if (barCount === 0) return [];

    const barGroupWidth = 100 / barCount;
    const actualBarWidth = barGroupWidth * (1 - barSpacing);

    return labels.map((label, labelIndex) => {
      const baseX = labelIndex * barGroupWidth + (barGroupWidth * barSpacing) / 2;

      if (stacked) {
        // Stacked bars
        let cumulativeHeight = 0;
        const segments = normalizedSeries
          .map((s) => {
            const point = s.data.find((p) => p.label === label);
            if (!point) return null;

            const segmentHeight = ((point.value - chartDimensions.minY) / chartDimensions.rangeY) * 100;
            const segment = {
              series: s,
              point,
              x: baseX,
              y: 100 - cumulativeHeight - segmentHeight,
              width: actualBarWidth,
              height: segmentHeight,
            };

            cumulativeHeight += segmentHeight;
            return segment;
          })
          .filter((seg): seg is NonNullable<typeof seg> => seg !== null);

        return {
          label,
          labelIndex,
          segments,
        };
      } else {
        // Grouped bars
        const seriesCount = normalizedSeries.length;
        const individualBarWidth = actualBarWidth / seriesCount;

        const segments = normalizedSeries
          .map((s, seriesIndex) => {
            const point = s.data.find((p) => p.label === label);
            if (!point) return null;

            const barHeight = ((point.value - chartDimensions.minY) / chartDimensions.rangeY) * 100;
            const barX = baseX + seriesIndex * individualBarWidth;

            return {
              series: s,
              point,
              x: barX,
              y: 100 - barHeight,
              width: individualBarWidth,
              height: barHeight,
            };
          })
          .filter((seg): seg is NonNullable<typeof seg> => seg !== null);

        return {
          label,
          labelIndex,
          segments,
        };
      }
    });
  }, [chartDimensions, normalizedSeries, stacked, barSpacing]);

  // Loading skeleton
  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
        {title && <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />}
        <div className="animate-pulse" style={{ height: `${height}px` }}>
          <div className="h-full bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  // Empty state
  if (normalizedSeries.length === 0 || chartDimensions.barCount === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
        {title && <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>}
        <div
          className="flex items-center justify-center text-gray-500 dark:text-gray-400"
          style={{ height: `${height}px` }}
        >
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
      )}

      {/* Chart */}
      <div className="relative" style={{ height: `${height}px` }}>
        {/* Y-axis labels */}
        {showYAxis && (
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 -ml-16 w-14 text-right">
            {axisLabels.y
              .slice()
              .reverse()
              .map((label, index) => (
                <span key={index}>{label.label}</span>
              ))}
          </div>
        )}

        {/* SVG Chart */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
          onMouseLeave={() => setHoveredBar(null)}
        >
          {/* Grid lines */}
          {showGrid && (
            <g className="text-gray-200 dark:text-gray-700" opacity="0.5">
              {gridLines.horizontal.map((y, index) => (
                <line
                  key={`h-${index}`}
                  x1="0"
                  x2="100"
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}

          {/* Bars */}
          {bars.map((bar) => (
            <g key={bar.label}>
              {bar.segments.map((segment, segmentIndex) => {
                const isHovered =
                  hoveredBar?.barIndex === bar.labelIndex &&
                  hoveredBar?.seriesId === segment.series.id;

                return (
                  <rect
                    key={`${segment.series.id}-${segmentIndex}`}
                    x={segment.x}
                    y={segment.y}
                    width={segment.width}
                    height={segment.height}
                    fill={segment.point.color || segment.series.color}
                    opacity={isHovered ? 1 : 0.85}
                    onMouseEnter={() =>
                      setHoveredBar({ seriesId: segment.series.id, barIndex: bar.labelIndex })
                    }
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                  />
                );
              })}
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredBar && (() => {
          const bar = bars[hoveredBar.barIndex];
          const segment = bar?.segments.find((s) => s.series.id === hoveredBar.seriesId);

          if (!bar || !segment) return null;

          // Calculate total for stacked bars
          const total = stacked
            ? bar.segments.reduce((sum, seg) => sum + seg.point.value, 0)
            : undefined;

          return (
            <div
              className="absolute bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-3 py-2 shadow-lg pointer-events-none z-10"
              style={{
                left: `${segment.x + segment.width / 2}%`,
                top: `${segment.y}%`,
                transform: 'translate(-50%, -120%)',
              }}
            >
              {formatTooltip ? (
                formatTooltip(segment.point, segment.series, total)
              ) : (
                <>
                  {normalizedSeries.length > 1 && (
                    <div
                      className="font-semibold mb-1"
                      style={{ color: segment.series.color }}
                    >
                      {segment.series.name}
                    </div>
                  )}
                  <div className="font-semibold">{formatYAxis(segment.point.value)}</div>
                  <div className="text-gray-300 dark:text-gray-400">{bar.label}</div>
                  {stacked && total !== undefined && (
                    <div className="text-gray-300 dark:text-gray-400 mt-1 text-[10px]">
                      Total: {formatYAxis(total)}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* X-axis labels */}
      {showXAxis && (
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          {chartDimensions.labels.map((label, index) => (
            <span
              key={index}
              className="truncate"
              style={{ maxWidth: `${100 / chartDimensions.labels.length}%` }}
              title={label}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Legend for multiple series */}
      {normalizedSeries.length > 1 && (
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {normalizedSeries.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
