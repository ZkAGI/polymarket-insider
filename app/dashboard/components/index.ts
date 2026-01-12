export { default as DashboardLayout } from './DashboardLayout';
export type { DashboardLayoutProps } from './DashboardLayout';

export { default as WidgetContainer } from './WidgetContainer';
export type { WidgetContainerProps } from './WidgetContainer';

export { DashboardSkeleton } from './DashboardSkeleton';

export { default as AlertFeed } from './AlertFeed';
export type {
  AlertFeedProps,
  FeedAlert,
  AlertType,
  AlertSeverity,
} from './AlertFeed';
export {
  getAlertTypeIcon,
  getAlertTypeLabel,
  getSeverityColor,
  getSeverityBorderColor,
  formatTimeAgo,
  generateMockAlerts,
} from './AlertFeed';

export { default as ActiveSignalsCounter } from './ActiveSignalsCounter';
export type {
  ActiveSignalsCounterProps,
  SignalCount,
  SignalType,
  SignalStatus,
} from './ActiveSignalsCounter';
export {
  signalConfig,
  getSignalConfig,
  getStatusColor,
  getTrendIndicator,
  generateMockSignals,
} from './ActiveSignalsCounter';

export { default as SuspiciousWalletsWidget } from './SuspiciousWalletsWidget';
export type {
  SuspiciousWalletsWidgetProps,
  SuspiciousWallet,
  SuspicionLevel,
  RiskFlag,
} from './SuspiciousWalletsWidget';
export {
  suspicionLevelConfig,
  riskFlagConfig,
  getSuspicionLevelConfig,
  getRiskFlagConfig,
  formatWalletAddress,
  formatVolume,
  formatTimeAgo as formatWalletTimeAgo,
  getSuspicionLevelFromScore,
  generateMockWallets,
} from './SuspiciousWalletsWidget';

export { default as HotMarketsWidget } from './HotMarketsWidget';
export type {
  HotMarketsWidgetProps,
  HotMarket,
  HeatLevel,
  MarketCategory,
  MarketAlertType,
} from './HotMarketsWidget';
export {
  heatLevelConfig,
  categoryConfig,
  alertTypeConfig,
  getHeatLevelConfig,
  getCategoryConfig,
  getAlertTypeConfig,
  getHeatLevelFromScore,
  formatMarketVolume,
  formatPercentageChange,
  formatProbability,
  formatMarketTimeAgo,
  truncateTitle,
  generateMockMarkets,
} from './HotMarketsWidget';

export { default as RecentLargeTradesWidget } from './RecentLargeTradesWidget';
export type {
  RecentLargeTradesWidgetProps,
  LargeTrade,
  TradeDirection,
  TradeSizeCategory,
} from './RecentLargeTradesWidget';
export {
  sizeCategoryConfig,
  directionConfig,
  getSizeCategoryConfig,
  getDirectionConfig,
  getSizeCategoryFromValue,
  formatTradeWalletAddress,
  formatTradeUsdValue,
  formatTradePrice,
  formatTradeTimeAgo,
  formatShareSize,
  truncateMarketTitle,
  generateMockTrades,
} from './RecentLargeTradesWidget';

export { default as SystemStatusIndicator } from './SystemStatusIndicator';
export type {
  SystemStatusIndicatorProps,
  DataSourceStatus,
  DataSourceType,
  ConnectionStatus,
  SystemHealth,
} from './SystemStatusIndicator';
export {
  dataSourceConfig,
  statusConfig,
  healthConfig,
  getDataSourceConfig,
  getStatusConfig,
  getHealthConfig,
  calculateSystemHealth,
  formatLatency,
  getLatencyColor,
  formatTimeSince,
  generateMockSources,
} from './SystemStatusIndicator';

export { default as QuickStatsSummaryBar } from './QuickStatsSummaryBar';
export type {
  QuickStatsSummaryBarProps,
  StatValue,
  StatType,
  StatCategory,
  TrendDirection,
} from './QuickStatsSummaryBar';
export {
  statTypeConfig,
  trendConfig,
  getStatTypeConfig,
  getTrendConfig,
  calculateTrend,
  formatStatValue,
  formatTrendValue,
  formatLastUpdated,
  generateMockStats,
} from './QuickStatsSummaryBar';

export { default as DashboardRefreshControls } from './DashboardRefreshControls';
export type {
  DashboardRefreshControlsProps,
  RefreshInterval,
  RefreshState,
  RefreshIntervalConfig,
} from './DashboardRefreshControls';
export {
  refreshIntervalConfig,
  getRefreshIntervalConfig,
  getRefreshIntervalOptions,
  formatRelativeTime,
  formatTimeUntilRefresh,
  generateMockRefreshState,
} from './DashboardRefreshControls';

export { default as ThemeToggle } from './ThemeToggle';
export { ThemeToggleIcon, ThemeToggleButton, ThemeToggleDropdown } from './ThemeToggle';
export type {
  ThemeToggleProps,
  ThemeToggleMode,
  ThemeToggleSize,
} from './ThemeToggle';
export { generateMockThemeState } from './ThemeToggle';
