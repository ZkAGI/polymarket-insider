/**
 * Email notification module exports
 */

// Export types
export type {
  EmailRecipient,
  EmailAttachment,
  EmailMessage,
  EmailSendResult,
  EmailClientConfig,
  EmailEvent,
  EmailEventHandler,
  BatchEmailOptions,
  BatchEmailResult,
  AlertEmailData,
  DigestEmailData,
  RecipientInput,
} from './types';

// Export enums and functions (these are values, not just types)
export {
  EmailPriority,
  EmailStatus,
  normalizeRecipients,
  extractEmails,
  isValidEmail,
  formatRecipient,
} from './types';

// Re-export the EmailEventType type
export type { EmailEventType } from './types';

// Export client
export {
  EmailClient,
  EmailClientError,
  getEmailClient,
  createEmailClient,
  resetEmailClient,
} from './client';

// Export alert email template types
export type {
  AlertSeverity,
  AlertType,
  AlertTemplateData,
  AlertEmailOptions,
  RenderedEmail,
  SeverityColors,
  AlertTypeConfig,
} from './templates';

// Export alert email template functions
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
} from './templates';
