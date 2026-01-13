'use client';

import { useMemo } from 'react';
import { LineChart, LineChartSeries } from '../charts/LineChart';
import { BarChart, BarChartDataPoint, BarChartSeries } from '../charts/BarChart';

/**
 * Model performance dashboard types
 * These mirror the service types for client-side use
 */

export enum ModelType {
  INSIDER_PREDICTOR = 'INSIDER_PREDICTOR',
  MARKET_PREDICTOR = 'MARKET_PREDICTOR',
  SIGNAL_TRACKER = 'SIGNAL_TRACKER',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum DashboardTimeWindow {
  LAST_HOUR = 'LAST_HOUR',
  LAST_24H = 'LAST_24H',
  LAST_7D = 'LAST_7D',
  LAST_30D = 'LAST_30D',
  ALL_TIME = 'ALL_TIME',
}

export interface ModelPerformanceMetrics {
  modelType: ModelType;
  modelName: string;
  totalPredictions: number;
  verifiedPredictions: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  brierScore: number;
  aucRoc: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  isHealthy: boolean;
  healthMessage: string;
  lastUpdated: Date;
}

export interface AccuracyDataPoint {
  timestamp: Date;
  accuracy: number;
  sampleSize: number;
  rollingAvg7d?: number;
  rollingAvg30d?: number;
}

export interface AccuracyTrend {
  modelType: ModelType;
  dataPoints: AccuracyDataPoint[];
  currentAccuracy: number;
  previousAccuracy: number;
  change: number;
  changePercent: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  timeWindow: DashboardTimeWindow;
}

export interface PerformanceAlert {
  alertId: string;
  modelType: ModelType;
  severity: AlertSeverity;
  title: string;
  description: string;
  currentValue: number;
  thresholdValue: number;
  difference: number;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  recommendedActions: string[];
}

export interface DashboardSummary {
  overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  healthScore: number;
  totalPredictions: number;
  totalVerified: number;
  averageAccuracy: number;
  activeAlerts: number;
  bestPerformingModel?: {
    modelType: ModelType;
    accuracy: number;
  };
  worstPerformingModel?: {
    modelType: ModelType;
    accuracy: number;
  };
  lastRefresh: Date;
}

/**
 * Model type display names
 */
const MODEL_TYPE_NAMES: Record<ModelType, string> = {
  [ModelType.INSIDER_PREDICTOR]: 'Insider Probability Predictor',
  [ModelType.MARKET_PREDICTOR]: 'Market Outcome Predictor',
  [ModelType.SIGNAL_TRACKER]: 'Signal Effectiveness Tracker',
};

/**
 * Alert severity colors
 */
const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  [AlertSeverity.INFO]: '#3B82F6',
  [AlertSeverity.WARNING]: '#F59E0B',
  [AlertSeverity.CRITICAL]: '#EF4444',
};

/**
 * Health status colors
 */
const HEALTH_STATUS_COLORS: Record<'HEALTHY' | 'WARNING' | 'CRITICAL', string> = {
  HEALTHY: '#10B981',
  WARNING: '#F59E0B',
  CRITICAL: '#EF4444',
};

/**
 * Format accuracy as percentage
 */
function formatAccuracy(accuracy: number): string {
  return `${(accuracy * 100).toFixed(1)}%`;
}

/**
 * Format number with abbreviation
 */
function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Props for ModelPerformanceDashboard component
 */
export interface ModelPerformanceDashboardProps {
  /** Dashboard summary data */
  summary?: DashboardSummary;
  /** Model metrics by type */
  modelMetrics?: Map<ModelType, ModelPerformanceMetrics>;
  /** Accuracy trends by model */
  accuracyTrends?: Map<ModelType, AccuracyTrend>;
  /** Active alerts */
  alerts?: PerformanceAlert[];
  /** Whether data is loading */
  loading?: boolean;
  /** Current time window selection */
  timeWindow?: DashboardTimeWindow;
  /** Callback when time window changes */
  onTimeWindowChange?: (window: DashboardTimeWindow) => void;
  /** Callback when refresh is requested */
  onRefresh?: () => void;
  /** Callback when alert is acknowledged */
  onAlertAcknowledge?: (alertId: string) => void;
  /** Additional CSS class */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Health Badge Component
 */
function HealthBadge({
  health,
  score,
}: {
  health: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  score: number;
}) {
  const bgColor = {
    HEALTHY: 'bg-green-100 dark:bg-green-900',
    WARNING: 'bg-yellow-100 dark:bg-yellow-900',
    CRITICAL: 'bg-red-100 dark:bg-red-900',
  }[health];

  const textColor = {
    HEALTHY: 'text-green-800 dark:text-green-200',
    WARNING: 'text-yellow-800 dark:text-yellow-200',
    CRITICAL: 'text-red-800 dark:text-red-200',
  }[health];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${bgColor}`}>
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: HEALTH_STATUS_COLORS[health] }}
      />
      <span className={`text-sm font-medium ${textColor}`}>
        {health} ({score})
      </span>
    </div>
  );
}

/**
 * Trend Indicator Component
 */
function TrendIndicator({ trend, change }: { trend: 'UP' | 'DOWN' | 'STABLE'; change: number }) {
  const icon = {
    UP: '↑',
    DOWN: '↓',
    STABLE: '→',
  }[trend];

  const color = {
    UP: 'text-green-500',
    DOWN: 'text-red-500',
    STABLE: 'text-gray-500',
  }[trend];

  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <span>{icon}</span>
      <span>{change >= 0 ? '+' : ''}{(change * 100).toFixed(1)}%</span>
    </span>
  );
}

/**
 * Stat Card Component
 */
function StatCard({
  title,
  value,
  subtitle,
  trend,
  testId,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { direction: 'UP' | 'DOWN' | 'STABLE'; change: number };
  testId?: string;
}) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
      data-testid={testId}
    >
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
        {trend && <TrendIndicator trend={trend.direction} change={trend.change} />}
      </div>
      {subtitle && <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">{subtitle}</div>}
    </div>
  );
}

/**
 * Model Card Component
 */
function ModelCard({
  metrics,
  trend,
  testId,
}: {
  metrics: ModelPerformanceMetrics;
  trend?: AccuracyTrend;
  testId?: string;
}) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
      data-testid={testId}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">{metrics.modelName}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatNumber(metrics.totalPredictions)} predictions
          </p>
        </div>
        <div
          className={`w-3 h-3 rounded-full ${metrics.isHealthy ? 'bg-green-500' : 'bg-red-500'}`}
          title={metrics.healthMessage}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Accuracy</div>
          <div className="flex items-center gap-1">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatAccuracy(metrics.accuracy)}
            </span>
            {trend && <TrendIndicator trend={trend.trend} change={trend.change} />}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">F1 Score</div>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatAccuracy(metrics.f1Score)}
          </span>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Precision</div>
          <span className="text-gray-900 dark:text-white">{formatAccuracy(metrics.precision)}</span>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Recall</div>
          <span className="text-gray-900 dark:text-white">{formatAccuracy(metrics.recall)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <div className="text-green-600 dark:text-green-400 font-medium">
              {metrics.truePositives}
            </div>
            <div className="text-gray-400">TP</div>
          </div>
          <div>
            <div className="text-green-600 dark:text-green-400 font-medium">
              {metrics.trueNegatives}
            </div>
            <div className="text-gray-400">TN</div>
          </div>
          <div>
            <div className="text-red-600 dark:text-red-400 font-medium">
              {metrics.falsePositives}
            </div>
            <div className="text-gray-400">FP</div>
          </div>
          <div>
            <div className="text-red-600 dark:text-red-400 font-medium">
              {metrics.falseNegatives}
            </div>
            <div className="text-gray-400">FN</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Alert Card Component
 */
function AlertCard({
  alert,
  onAcknowledge,
  testId,
}: {
  alert: PerformanceAlert;
  onAcknowledge?: (alertId: string) => void;
  testId?: string;
}) {
  const severityBg = {
    [AlertSeverity.INFO]: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    [AlertSeverity.WARNING]:
      'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    [AlertSeverity.CRITICAL]:
      'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
  }[alert.severity];

  const severityText = {
    [AlertSeverity.INFO]: 'text-blue-800 dark:text-blue-200',
    [AlertSeverity.WARNING]: 'text-yellow-800 dark:text-yellow-200',
    [AlertSeverity.CRITICAL]: 'text-red-800 dark:text-red-200',
  }[alert.severity];

  return (
    <div
      className={`rounded-lg p-4 border ${severityBg} ${alert.acknowledged ? 'opacity-50' : ''}`}
      data-testid={testId}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-2">
          <div
            className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
            style={{ backgroundColor: ALERT_SEVERITY_COLORS[alert.severity] }}
          />
          <div>
            <h4 className={`font-medium ${severityText}`}>{alert.title}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{alert.description}</p>
          </div>
        </div>
        {!alert.acknowledged && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.alertId)}
            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Acknowledge
          </button>
        )}
      </div>
      {alert.recommendedActions.length > 0 && !alert.acknowledged && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recommended Actions:</div>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {alert.recommendedActions.slice(0, 3).map((action, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-gray-400">-</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Time Window Selector Component
 */
function TimeWindowSelector({
  selected,
  onChange,
  testId,
}: {
  selected: DashboardTimeWindow;
  onChange: (window: DashboardTimeWindow) => void;
  testId?: string;
}) {
  const options: { value: DashboardTimeWindow; label: string }[] = [
    { value: DashboardTimeWindow.LAST_HOUR, label: '1H' },
    { value: DashboardTimeWindow.LAST_24H, label: '24H' },
    { value: DashboardTimeWindow.LAST_7D, label: '7D' },
    { value: DashboardTimeWindow.LAST_30D, label: '30D' },
    { value: DashboardTimeWindow.ALL_TIME, label: 'All' },
  ];

  return (
    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1" data-testid={testId}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            selected === option.value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Model Performance Dashboard Component
 *
 * Displays AI model performance metrics, accuracy trends over time,
 * and alerts for performance drops.
 */
export function ModelPerformanceDashboard({
  summary,
  modelMetrics,
  accuracyTrends,
  alerts = [],
  loading = false,
  timeWindow = DashboardTimeWindow.LAST_30D,
  onTimeWindowChange,
  onRefresh,
  onAlertAcknowledge,
  className = '',
  testId = 'model-performance-dashboard',
}: ModelPerformanceDashboardProps) {
  // Convert accuracy trends to chart data
  const accuracyChartData = useMemo((): LineChartSeries[] => {
    if (!accuracyTrends) return [];

    const series: LineChartSeries[] = [];
    const colors = ['#3B82F6', '#10B981', '#F59E0B'];
    let colorIndex = 0;

    for (const [modelType, trend] of accuracyTrends) {
      if (trend.dataPoints.length > 0) {
        series.push({
          id: modelType,
          name: MODEL_TYPE_NAMES[modelType],
          color: colors[colorIndex % colors.length],
          showArea: false,
          strokeWidth: 2,
          showPoints: trend.dataPoints.length <= 30,
          data: trend.dataPoints.map((point) => ({
            x: new Date(point.timestamp),
            y: point.accuracy * 100,
          })),
        });
        colorIndex++;
      }
    }

    return series;
  }, [accuracyTrends]);

  // Convert model metrics to comparison chart data
  const comparisonChartData = useMemo((): BarChartSeries[] => {
    if (!modelMetrics) return [];

    const accuracyData: BarChartDataPoint[] = [];
    const precisionData: BarChartDataPoint[] = [];
    const recallData: BarChartDataPoint[] = [];

    for (const [modelType, metrics] of modelMetrics) {
      const label = MODEL_TYPE_NAMES[modelType].split(' ')[0] || modelType;
      accuracyData.push({ label, value: metrics.accuracy * 100 });
      precisionData.push({ label, value: metrics.precision * 100 });
      recallData.push({ label, value: metrics.recall * 100 });
    }

    return [
      { id: 'accuracy', name: 'Accuracy', data: accuracyData, color: '#3B82F6' },
      { id: 'precision', name: 'Precision', data: precisionData, color: '#10B981' },
      { id: 'recall', name: 'Recall', data: recallData, color: '#F59E0B' },
    ];
  }, [modelMetrics]);

  // Active alerts only
  const activeAlerts = useMemo(() => alerts.filter((a) => !a.acknowledged), [alerts]);

  if (loading) {
    return (
      <div
        className={`animate-pulse space-y-4 ${className}`}
        data-testid={`${testId}-loading`}
      >
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid={testId}>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            AI Model Performance
          </h2>
          {summary && <HealthBadge health={summary.overallHealth} score={summary.healthScore} />}
        </div>
        <div className="flex items-center gap-3">
          {onTimeWindowChange && (
            <TimeWindowSelector
              selected={timeWindow}
              onChange={onTimeWindowChange}
              testId={`${testId}-time-selector`}
            />
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              data-testid={`${testId}-refresh-btn`}
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid={`${testId}-summary`}>
          <StatCard
            title="Total Predictions"
            value={formatNumber(summary.totalPredictions)}
            subtitle={`${formatNumber(summary.totalVerified)} verified`}
            testId={`${testId}-total-predictions`}
          />
          <StatCard
            title="Average Accuracy"
            value={formatAccuracy(summary.averageAccuracy)}
            testId={`${testId}-avg-accuracy`}
          />
          <StatCard
            title="Active Alerts"
            value={summary.activeAlerts}
            testId={`${testId}-active-alerts`}
          />
          <StatCard
            title="Best Model"
            value={
              summary.bestPerformingModel
                ? formatAccuracy(summary.bestPerformingModel.accuracy)
                : 'N/A'
            }
            subtitle={
              summary.bestPerformingModel
                ? MODEL_TYPE_NAMES[summary.bestPerformingModel.modelType].split(' ')[0]
                : undefined
            }
            testId={`${testId}-best-model`}
          />
        </div>
      )}

      {/* Alerts Section */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3" data-testid={`${testId}-alerts`}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Active Alerts ({activeAlerts.length})
          </h3>
          <div className="space-y-2">
            {activeAlerts.slice(0, 5).map((alert) => (
              <AlertCard
                key={alert.alertId}
                alert={alert}
                onAcknowledge={onAlertAcknowledge}
                testId={`${testId}-alert-${alert.alertId}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Model Cards */}
      {modelMetrics && modelMetrics.size > 0 && (
        <div className="space-y-3" data-testid={`${testId}-models`}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Model Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from(modelMetrics).map(([modelType, metrics]) => (
              <ModelCard
                key={modelType}
                metrics={metrics}
                trend={accuracyTrends?.get(modelType)}
                testId={`${testId}-model-${modelType}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accuracy Over Time Chart */}
        {accuracyChartData.length > 0 && (
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
            data-testid={`${testId}-accuracy-chart`}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Accuracy Over Time
            </h3>
            <LineChart
              series={accuracyChartData}
              height={250}
              showGrid
              showXAxis
              showYAxis
              formatYAxis={(v) => `${v.toFixed(0)}%`}
            />
          </div>
        )}

        {/* Model Comparison Chart */}
        {comparisonChartData.length > 0 && (comparisonChartData[0]?.data?.length ?? 0) > 0 && (
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
            data-testid={`${testId}-comparison-chart`}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Model Comparison
            </h3>
            <BarChart
              series={comparisonChartData}
              height={250}
              showGrid
              showXAxis
              showYAxis
              formatYAxis={(v) => `${v.toFixed(0)}%`}
            />
          </div>
        )}
      </div>

      {/* Last Updated */}
      {summary && (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
          Last updated: {new Date(summary.lastRefresh).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default ModelPerformanceDashboard;
