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
