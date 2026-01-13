'use client';

import { useState, useMemo, useRef } from 'react';

/**
 * Price data point for historical price/probability data
 */
export interface PriceDataPoint {
  timestamp: Date;
  price: number;
  probability: number;
  volume?: number;
}

/**
 * Key event marker on the chart
 */
export interface ChartEvent {
  timestamp: Date;
  label: string;
  type: 'news' | 'trade' | 'alert' | 'other';
}

/**
 * Time range options for the chart
 */
export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | 'ALL';

interface MarketPriceChartProps {
  /** Historical price data points */
  priceHistory: PriceDataPoint[];
  /** Optional key events to display on chart */
  events?: ChartEvent[];
  /** Market outcome name */
  outcomeName: string;
  /** Chart height in pixels */
  height?: number;
  /** Enable zoom functionality */
  enableZoom?: boolean;
  /** Enable pan functionality */
  enablePan?: boolean;
  /** Show grid lines */
  showGrid?: boolean;
}

/**
 * MarketPriceChart Component
 *
 * Interactive price/probability chart showing market price history over time.
 * Features:
 * - Time range selector (1D, 1W, 1M, 3M, 6M, ALL)
 * - Interactive tooltips on hover
 * - Zoom and pan controls (optional)
 * - Key event markers
 * - Responsive SVG chart
 */
export function MarketPriceChart({
  priceHistory,
  events = [],
  outcomeName,
  height = 400,
  enableZoom = true,
  enablePan = true,
  showGrid = true,
}: MarketPriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [hoveredPoint, setHoveredPoint] = useState<PriceDataPoint | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);

  // Filter data by selected time range
  const filteredData = useMemo(() => {
    const now = new Date();
    const ranges: Record<TimeRange, number> = {
      '1D': 1,
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      'ALL': Infinity,
    };

    const days = ranges[selectedRange];
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return priceHistory.filter((point) => point.timestamp >= cutoff);
  }, [priceHistory, selectedRange]);

  // Apply zoom and pan
  const visibleData = useMemo(() => {
    if (zoomLevel === 1 && panOffset === 0) {
      return filteredData;
    }

    const totalPoints = filteredData.length;
    const visiblePoints = Math.max(10, Math.floor(totalPoints / zoomLevel));
    const maxOffset = Math.max(0, totalPoints - visiblePoints);
    const actualOffset = Math.max(0, Math.min(panOffset, maxOffset));

    return filteredData.slice(actualOffset, actualOffset + visiblePoints);
  }, [filteredData, zoomLevel, panOffset]);

  // Calculate chart dimensions
  const padding = { top: 20, right: 40, bottom: 40, left: 50 };
  const width = 800; // Base width, will be scaled by viewBox
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const { minPrice, maxPrice, xScale, yScale } = useMemo(() => {
    if (visibleData.length === 0) {
      return { minPrice: 0, maxPrice: 100, xScale: () => 0, yScale: () => 0 };
    }

    const prices = visibleData.map((d) => d.probability);
    const minPrice = Math.max(0, Math.min(...prices) - 5);
    const maxPrice = Math.min(100, Math.max(...prices) + 5);

    const timeRange = visibleData[visibleData.length - 1]!.timestamp.getTime() - visibleData[0]!.timestamp.getTime();

    const xScale = (timestamp: Date) => {
      const elapsed = timestamp.getTime() - visibleData[0]!.timestamp.getTime();
      return (elapsed / timeRange) * chartWidth;
    };

    const yScale = (probability: number) => {
      return chartHeight - ((probability - minPrice) / (maxPrice - minPrice)) * chartHeight;
    };

    return { minPrice, maxPrice, xScale, yScale };
  }, [visibleData, chartWidth, chartHeight]);

  // Generate path for line chart
  const linePath = useMemo(() => {
    if (visibleData.length === 0) return '';

    const points = visibleData.map((point) => {
      const x = padding.left + xScale(point.timestamp);
      const y = padding.top + yScale(point.probability);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [visibleData, xScale, yScale, padding]);

  // Generate area path for gradient fill
  const areaPath = useMemo(() => {
    if (visibleData.length === 0) return '';

    const points = visibleData.map((point) => {
      const x = padding.left + xScale(point.timestamp);
      const y = padding.top + yScale(point.probability);
      return `${x},${y}`;
    });

    const firstX = padding.left;
    const lastX = padding.left + xScale(visibleData[visibleData.length - 1]!.timestamp);
    const bottom = padding.top + chartHeight;

    return `M ${firstX},${bottom} L ${points.join(' L ')} L ${lastX},${bottom} Z`;
  }, [visibleData, xScale, yScale, padding, chartHeight]);

  // Generate Y-axis labels
  const yAxisLabels = useMemo(() => {
    const tickCount = 5;
    const labels: { value: number; y: number }[] = [];

    for (let i = 0; i <= tickCount; i++) {
      const value = minPrice + ((maxPrice - minPrice) * i) / tickCount;
      const y = padding.top + yScale(value);
      labels.push({ value, y });
    }

    return labels;
  }, [minPrice, maxPrice, yScale, padding]);

  // Generate X-axis labels
  const xAxisLabels = useMemo(() => {
    if (visibleData.length === 0) return [];

    const tickCount = 6;
    const labels: { date: Date; x: number; label: string }[] = [];

    for (let i = 0; i < tickCount; i++) {
      const index = Math.floor((visibleData.length - 1) * (i / (tickCount - 1)));
      const point = visibleData[index];
      if (!point) continue;

      const x = padding.left + xScale(point.timestamp);
      const label = formatDateLabel(point.timestamp, selectedRange);
      labels.push({ date: point.timestamp, x, label });
    }

    return labels;
  }, [visibleData, xScale, padding, selectedRange]);

  // Handle zoom
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev / 1.5, 1));
    if (zoomLevel <= 1.5) {
      setPanOffset(0);
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset(0);
  };

  // Handle pan
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!enablePan || zoomLevel === 1) return;
    setIsPanning(true);
    setPanStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !panStart) return;

    const delta = e.clientX - panStart;
    const pointsPerPixel = (filteredData.length / zoomLevel) / chartWidth;
    const offsetDelta = -Math.round(delta * pointsPerPixel);

    setPanOffset((prev) => {
      const totalPoints = filteredData.length;
      const visiblePoints = Math.floor(totalPoints / zoomLevel);
      const maxOffset = Math.max(0, totalPoints - visiblePoints);
      return Math.max(0, Math.min(prev + offsetDelta, maxOffset));
    });

    setPanStart(e.clientX);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setPanStart(null);
  };

  // Find nearest point on hover
  const handleMouseMoveOnChart = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartRef.current || visibleData.length === 0) return;

    const rect = chartRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const relativeX = svgX - padding.left;

    if (relativeX < 0 || relativeX > chartWidth) {
      setHoveredPoint(null);
      return;
    }

    // Find nearest data point
    const timeRange = visibleData[visibleData.length - 1]!.timestamp.getTime() - visibleData[0]!.timestamp.getTime();
    const hoveredTime = visibleData[0]!.timestamp.getTime() + (relativeX / chartWidth) * timeRange;

    let nearest = visibleData[0]!;
    let minDistance = Math.abs(nearest.timestamp.getTime() - hoveredTime);

    for (const point of visibleData) {
      const distance = Math.abs(point.timestamp.getTime() - hoveredTime);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    }

    setHoveredPoint(nearest);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Filter events in visible range
  const visibleEvents = useMemo(() => {
    if (visibleData.length === 0) return [];
    const start = visibleData[0]!.timestamp;
    const end = visibleData[visibleData.length - 1]!.timestamp;
    return events.filter((event) => event.timestamp >= start && event.timestamp <= end);
  }, [events, visibleData]);

  if (priceHistory.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Price History</h3>
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          No price history data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header with title and time range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {outcomeName} Price History
        </h3>

        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['1D', '1W', '1M', '3M', '6M', 'ALL'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => {
                  setSelectedRange(range);
                  setZoomLevel(1);
                  setPanOffset(0);
                }}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  selectedRange === range
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      {enableZoom && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 10}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            🔍+
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            🔍-
          </button>
          <button
            onClick={handleResetZoom}
            disabled={zoomLevel === 1 && panOffset === 0}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Reset zoom"
          >
            Reset
          </button>
          {zoomLevel > 1 && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Zoom: {zoomLevel.toFixed(1)}x {enablePan && '(drag to pan)'}
            </span>
          )}
        </div>
      )}

      {/* Chart container */}
      <div className="relative">
        <svg
          ref={chartRef}
          viewBox={`0 0 ${width} ${height}`}
          className={`w-full ${enablePan && zoomLevel > 1 ? 'cursor-move' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={(e) => {
            handleMouseMove(e);
            handleMouseMoveOnChart(e);
          }}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            handleMouseLeave();
          }}
        >
          {/* Gradient definition for area fill */}
          <defs>
            <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {showGrid && (
            <g>
              {yAxisLabels.map((label, i) => (
                <line
                  key={`grid-y-${i}`}
                  x1={padding.left}
                  y1={label.y}
                  x2={padding.left + chartWidth}
                  y2={label.y}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  className="text-gray-200 dark:text-gray-700"
                />
              ))}
            </g>
          )}

          {/* Y-axis */}
          <g>
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + chartHeight}
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-300 dark:text-gray-600"
            />
            {yAxisLabels.map((label, i) => (
              <text
                key={`y-label-${i}`}
                x={padding.left - 10}
                y={label.y}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
              >
                {label.value.toFixed(0)}%
              </text>
            ))}
          </g>

          {/* X-axis */}
          <g>
            <line
              x1={padding.left}
              y1={padding.top + chartHeight}
              x2={padding.left + chartWidth}
              y2={padding.top + chartHeight}
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-300 dark:text-gray-600"
            />
            {xAxisLabels.map((label, i) => (
              <text
                key={`x-label-${i}`}
                x={label.x}
                y={padding.top + chartHeight + 20}
                textAnchor="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
              >
                {label.label}
              </text>
            ))}
          </g>

          {/* Area fill */}
          <path d={areaPath} fill="url(#priceGradient)" />

          {/* Line chart */}
          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Event markers */}
          {visibleEvents.map((event, i) => {
            const x = padding.left + xScale(event.timestamp);
            const eventColors = {
              news: '#f59e0b',
              trade: '#10b981',
              alert: '#ef4444',
              other: '#6b7280',
            };
            const color = eventColors[event.type];

            return (
              <g key={`event-${i}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + chartHeight}
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                <circle cx={x} cy={padding.top + 10} r="4" fill={color} />
                <title>{event.label}</title>
              </g>
            );
          })}

          {/* Hover indicator */}
          {hoveredPoint && (
            <g>
              <line
                x1={padding.left + xScale(hoveredPoint.timestamp)}
                y1={padding.top}
                x2={padding.left + xScale(hoveredPoint.timestamp)}
                y2={padding.top + chartHeight}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="2 2"
                className="text-gray-400 dark:text-gray-500"
              />
              <circle
                cx={padding.left + xScale(hoveredPoint.timestamp)}
                cy={padding.top + yScale(hoveredPoint.probability)}
                r="5"
                fill="#3b82f6"
                stroke="white"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute bg-gray-900 dark:bg-gray-700 text-white px-3 py-2 rounded shadow-lg text-sm pointer-events-none"
            style={{
              left: `${((padding.left + xScale(hoveredPoint.timestamp)) / width) * 100}%`,
              top: `${((padding.top + yScale(hoveredPoint.probability)) / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="font-semibold">{hoveredPoint.probability.toFixed(2)}%</div>
            <div className="text-xs text-gray-300">{formatTooltipDate(hoveredPoint.timestamp)}</div>
            {hoveredPoint.volume !== undefined && (
              <div className="text-xs text-gray-300">Vol: ${formatVolume(hoveredPoint.volume)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Format date for axis labels based on time range
 */
function formatDateLabel(date: Date, range: TimeRange): string {
  if (range === '1D') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  } else if (range === '1W') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else if (range === '1M' || range === '3M') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
}

/**
 * Format date for tooltip
 */
function formatTooltipDate(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format volume for display
 */
function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return volume.toFixed(0);
}
