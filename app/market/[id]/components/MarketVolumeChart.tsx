'use client';

import { useState, useMemo } from 'react';

/**
 * Volume data point for historical volume data
 */
export interface VolumeDataPoint {
  timestamp: Date;
  volume: number;
  tradeCount?: number;
}

/**
 * Time range options for the volume chart
 */
export type VolumeTimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | 'ALL';

/**
 * Anomaly detection result for volume spikes
 */
interface VolumeAnomaly {
  timestamp: Date;
  volume: number;
  deviationPercent: number;
}

interface MarketVolumeChartProps {
  /** Historical volume data points */
  volumeHistory: VolumeDataPoint[];
  /** Chart height in pixels */
  height?: number;
  /** Show grid lines */
  showGrid?: boolean;
  /** Highlight volume anomalies */
  highlightAnomalies?: boolean;
  /** Anomaly detection threshold (standard deviations) */
  anomalyThreshold?: number;
}

/**
 * MarketVolumeChart Component
 *
 * Interactive bar chart showing market trading volume over time.
 * Features:
 * - Time range selector (1D, 1W, 1M, 3M, 6M, ALL)
 * - Interactive tooltips on hover
 * - Volume trend visualization with bars
 * - Anomaly highlighting for unusual volume spikes
 * - Responsive SVG chart
 */
export function MarketVolumeChart({
  volumeHistory,
  height = 300,
  showGrid = true,
  highlightAnomalies = true,
  anomalyThreshold = 2.5,
}: MarketVolumeChartProps) {
  const [selectedRange, setSelectedRange] = useState<VolumeTimeRange>('1M');
  const [hoveredBar, setHoveredBar] = useState<VolumeDataPoint | null>(null);

  // Filter data by selected time range
  const filteredData = useMemo(() => {
    const now = new Date();
    const ranges: Record<VolumeTimeRange, number> = {
      '1D': 1,
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      'ALL': Infinity,
    };

    const days = ranges[selectedRange];
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return volumeHistory.filter((point) => point.timestamp >= cutoff);
  }, [volumeHistory, selectedRange]);

  // Detect volume anomalies
  const anomalies = useMemo((): VolumeAnomaly[] => {
    if (!highlightAnomalies || filteredData.length < 10) return [];

    const volumes = filteredData.map((d) => d.volume);
    const mean = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const variance = volumes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / volumes.length;
    const stdDev = Math.sqrt(variance);

    const detected: VolumeAnomaly[] = [];
    for (const point of filteredData) {
      const zScore = (point.volume - mean) / stdDev;
      if (zScore > anomalyThreshold) {
        detected.push({
          timestamp: point.timestamp,
          volume: point.volume,
          deviationPercent: ((point.volume - mean) / mean) * 100,
        });
      }
    }

    return detected;
  }, [filteredData, highlightAnomalies, anomalyThreshold]);

  // Calculate chart dimensions
  const padding = { top: 20, right: 40, bottom: 60, left: 60 };
  const width = 800; // Base width, will be scaled by viewBox
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const { maxVolume, xScale, yScale } = useMemo(() => {
    if (filteredData.length === 0) {
      return { maxVolume: 0, xScale: () => 0, yScale: () => 0 };
    }

    const volumes = filteredData.map((d) => d.volume);
    const maxVolume = Math.max(...volumes);
    const paddedMax = maxVolume * 1.1; // Add 10% padding at top

    const timeRange =
      filteredData[filteredData.length - 1]!.timestamp.getTime() -
      filteredData[0]!.timestamp.getTime();

    const xScale = (timestamp: Date) => {
      const elapsed = timestamp.getTime() - filteredData[0]!.timestamp.getTime();
      return (elapsed / timeRange) * chartWidth;
    };

    const yScale = (volume: number) => {
      return chartHeight - (volume / paddedMax) * chartHeight;
    };

    return { maxVolume: paddedMax, xScale, yScale };
  }, [filteredData, chartWidth, chartHeight]);

  // Calculate bar width based on number of data points
  const barWidth = useMemo(() => {
    if (filteredData.length === 0) return 0;
    const spacing = chartWidth / filteredData.length;
    return Math.max(2, Math.min(spacing * 0.8, 20)); // Between 2 and 20 pixels
  }, [filteredData.length, chartWidth]);

  // Format volume for display
  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}k`;
    }
    return `$${volume.toFixed(0)}`;
  };

  // Format date based on time range
  const formatDate = (date: Date): string => {
    if (selectedRange === '1D') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (selectedRange === '1W' || selectedRange === '1M') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  };

  // Generate Y-axis labels
  const yAxisLabels = useMemo(() => {
    const labelCount = 5;
    const labels: Array<{ value: number; y: number; label: string }> = [];

    for (let i = 0; i <= labelCount; i++) {
      const value = (maxVolume * i) / labelCount;
      const y = padding.top + yScale(value);
      labels.push({
        value,
        y,
        label: formatVolume(value),
      });
    }

    return labels;
  }, [maxVolume, yScale, padding.top]);

  // Generate X-axis labels (sample 6 evenly spaced points)
  const xAxisLabels = useMemo(() => {
    if (filteredData.length === 0) return [];

    const labelCount = Math.min(6, filteredData.length);
    const labels: Array<{ date: Date; x: number; label: string }> = [];

    for (let i = 0; i < labelCount; i++) {
      const index = Math.floor((i * (filteredData.length - 1)) / (labelCount - 1));
      const point = filteredData[index];
      if (point) {
        labels.push({
          date: point.timestamp,
          x: padding.left + xScale(point.timestamp),
          label: formatDate(point.timestamp),
        });
      }
    }

    return labels;
  }, [filteredData, xScale, padding.left, selectedRange]);

  // Check if a bar is an anomaly
  const isAnomaly = (timestamp: Date): boolean => {
    return anomalies.some((a) => a.timestamp.getTime() === timestamp.getTime());
  };

  // Time range buttons
  const timeRanges: VolumeTimeRange[] = ['1D', '1W', '1M', '3M', '6M', 'ALL'];

  if (volumeHistory.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Trading Volume
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          No volume data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header with title and time range selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Trading Volume
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Historical trading volume over time
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                selectedRange === range
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              data-testid={`volume-range-${range}`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ maxHeight: `${height}px` }}
          data-testid="volume-chart-svg"
        >
          {/* Grid lines */}
          {showGrid && (
            <g className="grid-lines">
              {yAxisLabels.map((label, i) => (
                <line
                  key={i}
                  x1={padding.left}
                  y1={label.y}
                  x2={width - padding.right}
                  y2={label.y}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  className="text-gray-200 dark:text-gray-700"
                />
              ))}
            </g>
          )}

          {/* Y-axis */}
          <g className="y-axis">
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={height - padding.bottom}
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-300 dark:text-gray-600"
            />
            {yAxisLabels.map((label, i) => (
              <text
                key={i}
                x={padding.left - 10}
                y={label.y}
                textAnchor="end"
                alignmentBaseline="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
                data-testid={`y-axis-label-${i}`}
              >
                {label.label}
              </text>
            ))}
          </g>

          {/* X-axis */}
          <g className="x-axis">
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-300 dark:text-gray-600"
            />
            {xAxisLabels.map((label, i) => (
              <text
                key={i}
                x={label.x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
                data-testid={`x-axis-label-${i}`}
              >
                {label.label}
              </text>
            ))}
          </g>

          {/* Volume bars */}
          <g className="volume-bars">
            {filteredData.map((point, i) => {
              const x = padding.left + xScale(point.timestamp) - barWidth / 2;
              const y = padding.top + yScale(point.volume);
              const barHeight = chartHeight - yScale(point.volume);
              const isHovered = hoveredBar?.timestamp.getTime() === point.timestamp.getTime();
              const isAnomalyBar = isAnomaly(point.timestamp);

              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  className={`transition-opacity cursor-pointer ${
                    isAnomalyBar
                      ? 'fill-red-500 dark:fill-red-400'
                      : 'fill-blue-500 dark:fill-blue-400'
                  } ${isHovered ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                  onMouseEnter={() => setHoveredBar(point)}
                  onMouseLeave={() => setHoveredBar(null)}
                  data-testid={`volume-bar-${i}`}
                />
              );
            })}
          </g>

          {/* Anomaly markers */}
          {highlightAnomalies &&
            anomalies.map((anomaly, i) => {
              const x = padding.left + xScale(anomaly.timestamp);
              const y = padding.top + yScale(anomaly.volume) - 10;

              return (
                <g key={i} data-testid={`anomaly-marker-${i}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    className="fill-red-600 dark:fill-red-400"
                  />
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    className="text-xs fill-red-600 dark:fill-red-400 font-semibold"
                  >
                    ⚠
                  </text>
                </g>
              );
            })}
        </svg>

        {/* Tooltip */}
        {hoveredBar && (
          <div
            className="absolute bg-gray-900 dark:bg-gray-700 text-white px-3 py-2 rounded shadow-lg text-sm pointer-events-none z-10"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            data-testid="volume-tooltip"
          >
            <div className="font-semibold mb-1">{formatDate(hoveredBar.timestamp)}</div>
            <div className="text-blue-300 dark:text-blue-200">
              Volume: {formatVolume(hoveredBar.volume)}
            </div>
            {hoveredBar.tradeCount && (
              <div className="text-gray-300 dark:text-gray-400 text-xs">
                Trades: {hoveredBar.tradeCount.toLocaleString()}
              </div>
            )}
            {isAnomaly(hoveredBar.timestamp) && (
              <div className="text-red-300 dark:text-red-200 text-xs mt-1 font-semibold">
                ⚠ Volume spike detected
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 dark:bg-blue-400 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Normal volume</span>
        </div>
        {highlightAnomalies && anomalies.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 dark:bg-red-400 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">
              Unusual spike ({anomalies.length})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
