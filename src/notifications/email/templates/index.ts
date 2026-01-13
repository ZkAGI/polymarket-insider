/**
 * Email template exports
 */

// Export types
export type {
  AlertSeverity,
  AlertType,
  AlertTemplateData,
  AlertEmailOptions,
  RenderedEmail,
  SeverityColors,
  AlertTypeConfig,
} from './types';

// Export alert template functions and constants
export {
  // Constants
  SEVERITY_COLORS,
  ALERT_TYPE_CONFIG,
  // Rendering functions
  renderAlertEmail,
  generateAlertHtml,
  generateAlertPlainText,
  generateSubject,
  createAlertEmailMessage,
  // Utility functions
  formatEmailDate,
  formatCurrency,
  formatPercentage,
  truncateAddress,
  escapeHtml,
  getSeverityLabel,
  getSeverityColors,
  getAlertTypeConfig,
  // Validation
  validateAlertTemplateData,
  // Preview (development)
  getAlertEmailPreviewHtml,
} from './alert-template';

// Export digest types
export type {
  DigestAlertSummary,
  DigestWalletSummary,
  DigestMarketSummary,
  DigestAlertCounts,
  DigestAlertsByType,
  DigestTradingStats,
  DigestPeriodComparison,
  DigestHighlight,
  DailyDigestData,
  DigestEmailOptions,
  DigestScheduleConfig,
} from './digest-types';

export {
  DEFAULT_DIGEST_OPTIONS,
  DEFAULT_SCHEDULE_CONFIG,
} from './digest-types';

// Export digest template functions
export {
  // Formatting utilities
  formatDigestDate,
  formatDigestTime,
  formatCompactNumber,
  getTrendIndicator,
  // Rendering functions
  generateDigestSubject,
  generateDigestHtml,
  generateDigestPlainText,
  renderDigestEmail,
  createDigestEmailMessage,
  // Validation
  validateDigestData,
  // Sample data for testing
  createSampleDigestData,
  // Preview (development)
  getDigestEmailPreviewHtml,
} from './digest-template';

// Export scheduler types and functions
export type {
  SupportedTimezone,
  ScheduledDigestJob,
  DigestSchedulerEventType,
  DigestSchedulerEvent,
  DigestDataProvider,
  EmailSendFunction,
  DigestSchedulerConfig,
} from './digest-scheduler';

export {
  SUPPORTED_TIMEZONES,
  // Timezone utilities
  isValidTimezone,
  getCurrentTimeInTimezone,
  getTimeComponentsInTimezone,
  // Scheduling utilities
  calculateNextRunTime,
  isScheduledTimeDue,
  getDigestDateFromRunTime,
  // Scheduler class
  DigestScheduler,
  createDigestScheduler,
  // Configuration helpers
  validateScheduleConfig,
  createScheduleConfig,
} from './digest-scheduler';
