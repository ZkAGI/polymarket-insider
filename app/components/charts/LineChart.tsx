'use client';

import { useState, useMemo } from 'react';

/**
 * Data point for line chart
 */
export interface LineChartDataPoint {
  /** X-axis value (timestamp or number) */
  x: number | Date;
  /** Y-axis value */
  y: number;
  /** Optional label for tooltip */
  label?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Series configuration for multi-line charts
 */
export interface LineChartSeries {
  /** Unique identifier for the series */
  id: string;
  /** Display name for the series */
  name: string;
  /** Data points for this series */
  data: LineChartDataPoint[];
  /** Line color (CSS color string) */
  color?: string;
  /** Whether to show area fill */
  showArea?: boolean;
  /** Area fill opacity (0-1) */
  areaOpacity?: number;
  /** Line stroke width */
  strokeWidth?: number;
  /** Whether to show data points */
  showPoints?: boolean;
}

/**
 * LineChart component props
 */
export interface LineChartProps {
  /** Single series data (simple mode) */
  data?: LineChartDataPoint[];
  /** Multiple series data (advanced mode) */
  series?: LineChartSeries[];
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
  /** X-axis label formatter */
  formatXAxis?: (value: number | Date) => string;
  /** Y-axis label formatter */
  formatYAxis?: (value: number) => string;
  /** Tooltip content formatter */
  formatTooltip?: (point: LineChartDataPoint, series?: LineChartSeries) => React.ReactNode;
  /** Whether chart is loading */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
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
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Default X-axis formatter
 */
function defaultFormatXAxis(value: number | Date): string {
  if (value instanceof Date) {
    return formatDate(value);
  }
  return formatNumber(value);
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
  data?: LineChartDataPoint[],
  series?: LineChartSeries[],
): LineChartSeries[] {
  if (series && series.length > 0) {
    return series.map((s, index) => ({
      ...s,
      color: s.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      showArea: s.showArea ?? false,
      areaOpacity: s.areaOpacity ?? 0.2,
      strokeWidth: s.strokeWidth ?? 2,
      showPoints: s.showPoints ?? true,
    }));
  }

  if (data && data.length > 0) {
    return [
      {
        id: 'default',
        name: 'Value',
        data,
        color: DEFAULT_COLORS[0],
        showArea: false,
        areaOpacity: 0.2,
        strokeWidth: 2,
        showPoints: true,
      },
    ];
  }

  return [];
}

/**
 * Reusable Line Chart Component
 *
 * Features:
 * - Single or multiple series support
 * - Responsive sizing
 * - Interactive tooltips
 * - Optional area fill
 * - Grid lines
 * - Axis labels
 * - Loading state
 * - Empty state
 */
export function LineChart({
  data,
  series,
  title,
  height = 300,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  formatXAxis = defaultFormatXAxis,
  formatYAxis = defaultFormatYAxis,
  formatTooltip,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
}: LineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    seriesId: string;
    pointIndex: number;
  } | null>(null);

  // Normalize series data
  const normalizedSeries = useMemo(() => normalizeSeries(data, series), [data, series]);

  // Calculate chart dimensions and scales
  const chartDimensions = useMemo(() => {
    if (normalizedSeries.length === 0) {
      return {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        rangeX: 1,
        rangeY: 1,
        allPoints: [],
      };
    }

    // Collect all data points from all series
    const allPoints = normalizedSeries.flatMap((s) =>
      s.data.map((point) => {
        const xValue = point.x instanceof Date ? point.x.getTime() : point.x;
        return { ...point, xValue, series: s };
      }),
    );

    if (allPoints.length === 0) {
      return {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        rangeX: 1,
        rangeY: 1,
        allPoints: [],
      };
    }

    const xValues = allPoints.map((p) => p.xValue);
    const yValues = allPoints.map((p) => p.y);

    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues, 0);
    const maxY = Math.max(...yValues);

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    return { minX, maxX, minY, maxY, rangeX, rangeY, allPoints };
  }, [normalizedSeries]);

  // Convert data point to SVG coordinates
  const toSVGCoords = (x: number | Date, y: number) => {
    const xValue = x instanceof Date ? x.getTime() : x;
    const svgX = ((xValue - chartDimensions.minX) / chartDimensions.rangeX) * 100;
    const svgY = 100 - ((y - chartDimensions.minY) / chartDimensions.rangeY) * 100;
    return { x: svgX, y: svgY };
  };

  // Generate SVG path for a series
  const generateLinePath = (seriesData: LineChartDataPoint[]) => {
    if (seriesData.length === 0) return '';

    return seriesData
      .map((point, index) => {
        const coords = toSVGCoords(point.x, point.y);
        const command = index === 0 ? 'M' : 'L';
        return `${command} ${coords.x} ${coords.y}`;
      })
      .join(' ');
  };

  // Generate SVG area path for a series
  const generateAreaPath = (seriesData: LineChartDataPoint[]) => {
    if (seriesData.length === 0) return '';

    const linePath = seriesData
      .map((point, index) => {
        const coords = toSVGCoords(point.x, point.y);
        const command = index === 0 ? 'M' : 'L';
        return `${command} ${coords.x} ${coords.y}`;
      })
      .join(' ');

    const firstPoint = seriesData[0];
    const lastPoint = seriesData[seriesData.length - 1];

    if (!firstPoint || !lastPoint) return '';

    const zeroY = 100 - ((0 - chartDimensions.minY) / chartDimensions.rangeY) * 100;
    const firstCoords = toSVGCoords(firstPoint.x, firstPoint.y);
    const lastCoords = toSVGCoords(lastPoint.x, lastPoint.y);

    return `${linePath} L ${lastCoords.x} ${zeroY} L ${firstCoords.x} ${zeroY} Z`;
  };

  // Calculate grid lines
  const gridLines = useMemo(() => {
    const yLines = 5;
    const xLines = 5;

    const yStep = 100 / yLines;
    const xStep = 100 / xLines;

    return {
      horizontal: Array.from({ length: yLines + 1 }, (_, i) => i * yStep),
      vertical: Array.from({ length: xLines + 1 }, (_, i) => i * xStep),
    };
  }, []);

  // Calculate axis labels
  const axisLabels = useMemo(() => {
    const yLabels = 5;
    const xLabels = 5;

    const yStep = chartDimensions.rangeY / yLabels;
    const xStep = chartDimensions.rangeX / xLabels;

    return {
      y: Array.from({ length: yLabels + 1 }, (_, i) => {
        const value = chartDimensions.minY + i * yStep;
        return { value, label: formatYAxis(value), position: (i * 100) / yLabels };
      }),
      x: Array.from({ length: xLabels + 1 }, (_, i) => {
        const value = chartDimensions.minX + i * xStep;
        const displayValue = chartDimensions.allPoints[0]?.x instanceof Date ? new Date(value) : value;
        return { value, label: formatXAxis(displayValue), position: (i * 100) / xLabels };
      }),
    };
  }, [chartDimensions, formatXAxis, formatYAxis]);

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
  if (normalizedSeries.length === 0 || chartDimensions.allPoints.length === 0) {
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
          onMouseLeave={() => setHoveredPoint(null)}
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
              {gridLines.vertical.map((x, index) => (
                <line
                  key={`v-${index}`}
                  x1={x}
                  x2={x}
                  y1="0"
                  y2="100"
                  stroke="currentColor"
                  strokeWidth="0.1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}

          {/* Series */}
          {normalizedSeries.map((series) => {
            const linePath = generateLinePath(series.data);
            const areaPath = generateAreaPath(series.data);

            return (
              <g key={series.id}>
                {/* Area fill */}
                {series.showArea && (
                  <path d={areaPath} fill={series.color} opacity={series.areaOpacity} />
                )}

                {/* Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={series.strokeWidth}
                  vectorEffect="non-scaling-stroke"
                />

                {/* Data points */}
                {series.showPoints &&
                  series.data.map((point, index) => {
                    const coords = toSVGCoords(point.x, point.y);
                    const isHovered =
                      hoveredPoint?.seriesId === series.id && hoveredPoint?.pointIndex === index;

                    return (
                      <circle
                        key={index}
                        cx={coords.x}
                        cy={coords.y}
                        r={isHovered ? 1.5 : 0.7}
                        fill={series.color}
                        vectorEffect="non-scaling-stroke"
                        onMouseEnter={() => setHoveredPoint({ seriesId: series.id, pointIndex: index })}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  })}

                {/* Hover targets */}
                {series.data.map((point, index) => {
                  const coords = toSVGCoords(point.x, point.y);
                  return (
                    <rect
                      key={`hover-${index}`}
                      x={coords.x - 2}
                      y="0"
                      width="4"
                      height="100"
                      fill="transparent"
                      onMouseEnter={() => setHoveredPoint({ seriesId: series.id, pointIndex: index })}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (() => {
          const series = normalizedSeries.find((s) => s.id === hoveredPoint.seriesId);
          const point = series?.data[hoveredPoint.pointIndex];

          if (!series || !point) return null;

          const coords = toSVGCoords(point.x, point.y);

          return (
            <div
              className="absolute bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-3 py-2 shadow-lg pointer-events-none z-10"
              style={{
                left: `${coords.x}%`,
                top: `${coords.y}%`,
                transform: 'translate(-50%, -120%)',
              }}
            >
              {formatTooltip ? (
                formatTooltip(point, series)
              ) : (
                <>
                  {normalizedSeries.length > 1 && (
                    <div className="font-semibold mb-1" style={{ color: series.color }}>
                      {series.name}
                    </div>
                  )}
                  <div className="font-semibold">{formatYAxis(point.y)}</div>
                  <div className="text-gray-300 dark:text-gray-400">
                    {formatXAxis(point.x)}
                  </div>
                  {point.label && (
                    <div className="text-gray-300 dark:text-gray-400 mt-1">{point.label}</div>
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
          {axisLabels.x.map((label, index) => (
            <span key={index}>{label.label}</span>
          ))}
        </div>
      )}

      {/* Legend for multiple series */}
      {normalizedSeries.length > 1 && (
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {normalizedSeries.map((series) => (
            <div key={series.id} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{series.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
