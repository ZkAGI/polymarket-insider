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
