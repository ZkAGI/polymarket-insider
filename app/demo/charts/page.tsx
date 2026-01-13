'use client';

import { LineChart, LineChartDataPoint, LineChartSeries } from '@/app/components/charts/LineChart';
import { BarChart, BarChartDataPoint, BarChartSeries } from '@/app/components/charts/BarChart';

/**
 * Demo page for Chart components
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

  // Bar chart demo data
  const barChartData: BarChartDataPoint[] = [
    { label: 'Jan', value: 4500 },
    { label: 'Feb', value: 5200 },
    { label: 'Mar', value: 4800 },
    { label: 'Apr', value: 6100 },
    { label: 'May', value: 5900 },
    { label: 'Jun', value: 7200 },
  ];

  // Stacked bar chart data
  const stackedBarSeries: BarChartSeries[] = [
    {
      id: 'whale',
      name: 'Whale Trades',
      data: [
        { label: 'Mon', value: 3200 },
        { label: 'Tue', value: 2800 },
        { label: 'Wed', value: 3500 },
        { label: 'Thu', value: 4100 },
        { label: 'Fri', value: 3800 },
        { label: 'Sat', value: 2200 },
        { label: 'Sun', value: 1900 },
      ],
      color: '#10b981',
    },
    {
      id: 'large',
      name: 'Large Trades',
      data: [
        { label: 'Mon', value: 1800 },
        { label: 'Tue', value: 2200 },
        { label: 'Wed', value: 1900 },
        { label: 'Thu', value: 2500 },
        { label: 'Fri', value: 2100 },
        { label: 'Sat', value: 1500 },
        { label: 'Sun', value: 1200 },
      ],
      color: '#3b82f6',
    },
    {
      id: 'regular',
      name: 'Regular Trades',
      data: [
        { label: 'Mon', value: 900 },
        { label: 'Tue', value: 1100 },
        { label: 'Wed', value: 950 },
        { label: 'Thu', value: 1300 },
        { label: 'Fri', value: 1050 },
        { label: 'Sat', value: 800 },
        { label: 'Sun', value: 700 },
      ],
      color: '#f59e0b',
    },
  ];

  // Grouped bar chart data
  const groupedBarSeries: BarChartSeries[] = [
    {
      id: 'yes',
      name: 'Yes Votes',
      data: [
        { label: 'Market A', value: 6500 },
        { label: 'Market B', value: 4200 },
        { label: 'Market C', value: 5800 },
        { label: 'Market D', value: 3900 },
      ],
      color: '#10b981',
    },
    {
      id: 'no',
      name: 'No Votes',
      data: [
        { label: 'Market A', value: 3500 },
        { label: 'Market B', value: 5800 },
        { label: 'Market C', value: 4200 },
        { label: 'Market D', value: 6100 },
      ],
      color: '#ef4444',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Chart Components Demo
        </h1>

        <div className="space-y-8">
          {/* Bar Charts Section */}
          <section className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 border-b-2 border-gray-300 dark:border-gray-700 pb-2">
              Bar Charts
            </h2>

            {/* Simple Bar Chart */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Simple Bar Chart
              </h3>
              <BarChart
                data={barChartData}
                title="Monthly Volume"
                height={300}
                showGrid={true}
                showXAxis={true}
                showYAxis={true}
                formatYAxis={(value) => `$${(value / 1000).toFixed(1)}K`}
              />
            </div>

            {/* Stacked Bar Chart */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Stacked Bar Chart
              </h3>
              <BarChart
                series={stackedBarSeries}
                title="Weekly Trade Volume by Size"
                height={350}
                stacked={true}
                showGrid={true}
                showXAxis={true}
                showYAxis={true}
                formatYAxis={(value) => `$${(value / 1000).toFixed(1)}K`}
              />
            </div>

            {/* Grouped Bar Chart */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Grouped Bar Chart
              </h3>
              <BarChart
                series={groupedBarSeries}
                title="Market Sentiment Comparison"
                height={350}
                stacked={false}
                showGrid={true}
                showXAxis={true}
                showYAxis={true}
                formatYAxis={(value) => `$${(value / 1000).toFixed(1)}K`}
              />
            </div>

            {/* Bar Chart Without Grid */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Without Grid Lines
              </h3>
              <BarChart
                data={barChartData}
                title="Clean View"
                height={250}
                showGrid={false}
                showXAxis={true}
                showYAxis={true}
                formatYAxis={(value) => `$${(value / 1000).toFixed(1)}K`}
              />
            </div>

            {/* Bar Chart Loading State */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Loading State
              </h3>
              <BarChart
                data={[]}
                title="Loading Chart"
                height={250}
                loading={true}
              />
            </div>

            {/* Bar Chart Empty State */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Empty State
              </h3>
              <BarChart
                data={[]}
                title="No Data Chart"
                height={250}
                emptyMessage="No trading data available"
              />
            </div>

            {/* Bar Chart with Custom Tooltip */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Custom Tooltip
              </h3>
              <BarChart
                data={barChartData}
                title="Custom Tooltip Example"
                height={250}
                formatTooltip={(point) => (
                  <div>
                    <div className="font-bold text-lg">${point.value.toLocaleString()}</div>
                    <div className="text-xs text-gray-300">{point.label}</div>
                    <div className="text-xs mt-1 italic">Click for details</div>
                  </div>
                )}
              />
            </div>
          </section>

          {/* Line Charts Section */}
          <section className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 border-b-2 border-gray-300 dark:border-gray-700 pb-2">
              Line Charts
            </h2>

          {/* Single Series Chart */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Single Series Chart
            </h3>
            <LineChart
              data={singleSeriesData}
              title="Price Over Time"
              height={300}
              showGrid={true}
              showXAxis={true}
              showYAxis={true}
              formatYAxis={(value) => `$${value.toFixed(0)}`}
            />
          </div>

          {/* Multiple Series Chart */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Multiple Series Chart
            </h3>
            <LineChart
              series={multipleSeriesData}
              title="Market Metrics"
              height={350}
              showGrid={true}
              showXAxis={true}
              showYAxis={true}
              formatYAxis={(value) => `$${value.toFixed(0)}`}
            />
          </div>

          {/* Numeric X-Axis Chart */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Numeric X-Axis Chart
            </h3>
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
          </div>

          {/* Without Grid */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Without Grid Lines
            </h3>
            <LineChart
              data={singleSeriesData}
              title="Clean View"
              height={250}
              showGrid={false}
              showXAxis={true}
              showYAxis={true}
            />
          </div>

          {/* Loading State */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Loading State
            </h3>
            <LineChart
              data={[]}
              title="Loading Chart"
              height={250}
              loading={true}
            />
          </div>

          {/* Empty State */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Empty State
            </h3>
            <LineChart
              data={[]}
              title="No Data Chart"
              height={250}
              emptyMessage="No data available for this time period"
            />
          </div>

          {/* Custom Tooltip */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Custom Tooltip
            </h3>
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
          </div>
          </section>
        </div>
      </div>
    </div>
  );
}
