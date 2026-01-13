'use client';

import { LineChart, LineChartDataPoint, LineChartSeries } from '@/app/components/charts/LineChart';

/**
 * Demo page for LineChart component
 */
export default function ChartsDemo() {
  // Single series demo data
  const singleSeriesData: LineChartDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
    x: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
    y: 100 + Math.sin(i / 5) * 50 + Math.random() * 20,
    label: `Day ${i + 1}`,
  }));

  // Multiple series demo data
  const multipleSeriesData: LineChartSeries[] = [
    {
      id: 'profit',
      name: 'Profit',
      data: Array.from({ length: 20 }, (_, i) => ({
        x: new Date(Date.now() - (19 - i) * 24 * 60 * 60 * 1000),
        y: 1000 + i * 50 + Math.random() * 100,
      })),
      color: '#10b981',
      showArea: true,
      areaOpacity: 0.2,
    },
    {
      id: 'volume',
      name: 'Volume',
      data: Array.from({ length: 20 }, (_, i) => ({
        x: new Date(Date.now() - (19 - i) * 24 * 60 * 60 * 1000),
        y: 500 + Math.sin(i / 3) * 200 + Math.random() * 100,
      })),
      color: '#3b82f6',
      showArea: true,
      areaOpacity: 0.15,
    },
    {
      id: 'trades',
      name: 'Trades',
      data: Array.from({ length: 20 }, (_, i) => ({
        x: new Date(Date.now() - (19 - i) * 24 * 60 * 60 * 1000),
        y: 200 + Math.cos(i / 4) * 100 + Math.random() * 50,
      })),
      color: '#f59e0b',
      showArea: false,
    },
  ];

  // Numeric X-axis demo data
  const numericData: LineChartDataPoint[] = Array.from({ length: 50 }, (_, i) => ({
    x: i,
    y: Math.sin(i / 5) * 30 + 50 + Math.random() * 10,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          LineChart Component Demo
        </h1>

        <div className="space-y-8">
          {/* Single Series Chart */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Single Series Chart
            </h2>
            <LineChart
              data={singleSeriesData}
              title="Price Over Time"
              height={300}
              showGrid={true}
              showXAxis={true}
              showYAxis={true}
              formatYAxis={(value) => `$${value.toFixed(0)}`}
            />
          </section>

          {/* Multiple Series Chart */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Multiple Series Chart
            </h2>
            <LineChart
              series={multipleSeriesData}
              title="Market Metrics"
              height={350}
              showGrid={true}
              showXAxis={true}
              showYAxis={true}
              formatYAxis={(value) => `$${value.toFixed(0)}`}
            />
          </section>

          {/* Numeric X-Axis Chart */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Numeric X-Axis Chart
            </h2>
            <LineChart
              data={numericData}
              title="Signal Strength"
              height={250}
              showGrid={true}
              showXAxis={true}
              showYAxis={true}
              formatXAxis={(value) => `${value}`}
              formatYAxis={(value) => `${value.toFixed(1)}`}
            />
          </section>

          {/* Without Grid */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Without Grid Lines
            </h2>
            <LineChart
              data={singleSeriesData}
              title="Clean View"
              height={250}
              showGrid={false}
              showXAxis={true}
              showYAxis={true}
            />
          </section>

          {/* Loading State */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Loading State
            </h2>
            <LineChart
              data={[]}
              title="Loading Chart"
              height={250}
              loading={true}
            />
          </section>

          {/* Empty State */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Empty State
            </h2>
            <LineChart
              data={[]}
              title="No Data Chart"
              height={250}
              emptyMessage="No data available for this time period"
            />
          </section>

          {/* Custom Tooltip */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Custom Tooltip
            </h2>
            <LineChart
              data={singleSeriesData}
              title="Custom Tooltip Example"
              height={250}
              formatTooltip={(point) => (
                <div>
                  <div className="font-bold text-lg">${(point.y as number).toFixed(2)}</div>
                  <div className="text-xs text-gray-300">
                    {point.x instanceof Date ? point.x.toLocaleDateString() : point.x}
                  </div>
                  {point.label && <div className="text-xs mt-1 italic">{point.label}</div>}
                </div>
              )}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
