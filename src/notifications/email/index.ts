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
