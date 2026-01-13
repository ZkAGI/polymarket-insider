/**
 * Unit tests for email notification types
 */

import { describe, it, expect } from 'vitest';
import {
  EmailPriority,
  EmailStatus,
  normalizeRecipients,
  extractEmails,
  isValidEmail,
  formatRecipient,
  EmailRecipient,
} from '../../../src/notifications/email/types';

describe('Email Types', () => {
  describe('EmailPriority enum', () => {
    it('should have LOW, NORMAL, and HIGH values', () => {
      expect(EmailPriority.LOW).toBe('low');
      expect(EmailPriority.NORMAL).toBe('normal');
      expect(EmailPriority.HIGH).toBe('high');
    });
  });

  describe('EmailStatus enum', () => {
    it('should have all expected status values', () => {
      expect(EmailStatus.PENDING).toBe('pending');
      expect(EmailStatus.SENT).toBe('sent');
      expect(EmailStatus.DELIVERED).toBe('delivered');
      expect(EmailStatus.BOUNCED).toBe('bounced');
      expect(EmailStatus.FAILED).toBe('failed');
    });
  });

  describe('normalizeRecipients', () => {
    it('should return empty array for null/undefined input', () => {
      expect(normalizeRecipients(null as unknown as string)).toEqual([]);
      expect(normalizeRecipients(undefined as unknown as string)).toEqual([]);
    });

    it('should convert single string email to recipient array', () => {
      const result = normalizeRecipients('test@example.com');
      expect(result).toEqual([{ email: 'test@example.com' }]);
    });

    it('should convert array of string emails to recipient array', () => {
      const result = normalizeRecipients(['a@test.com', 'b@test.com']);
      expect(result).toEqual([{ email: 'a@test.com' }, { email: 'b@test.com' }]);
    });

    it('should pass through EmailRecipient object unchanged', () => {
      const recipient: EmailRecipient = { email: 'test@example.com', name: 'Test User' };
      const result = normalizeRecipients(recipient);
      expect(result).toEqual([recipient]);
    });

    it('should pass through array of EmailRecipient objects unchanged', () => {
      const recipients: EmailRecipient[] = [
        { email: 'a@test.com', name: 'User A' },
        { email: 'b@test.com', name: 'User B' },
      ];
      const result = normalizeRecipients(recipients);
      expect(result).toEqual(recipients);
    });

    it('should handle mixed string and object inputs in array', () => {
      const input: (string | EmailRecipient)[] = ['string@test.com', { email: 'object@test.com', name: 'Object User' }];
      // Cast to compatible type for normalizeRecipients
      const result = normalizeRecipients(input as unknown as string[]);
      expect(result).toEqual([
        { email: 'string@test.com' },
        { email: 'object@test.com', name: 'Object User' },
      ]);
    });
  });

  describe('extractEmails', () => {
    it('should extract email addresses from recipient array', () => {
      const recipients: EmailRecipient[] = [
        { email: 'a@test.com', name: 'User A' },
        { email: 'b@test.com' },
        { email: 'c@test.com', name: 'User C' },
      ];
      const result = extractEmails(recipients);
      expect(result).toEqual(['a@test.com', 'b@test.com', 'c@test.com']);
    });

    it('should return empty array for empty input', () => {
      expect(extractEmails([])).toEqual([]);
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@gmail.com')).toBe(true);
      expect(isValidEmail('a@b.co')).toBe(true);
      expect(isValidEmail('test123@sub.domain.org')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@domain')).toBe(false);
      expect(isValidEmail('user @domain.com')).toBe(false);
      expect(isValidEmail('user@ domain.com')).toBe(false);
      expect(isValidEmail('user@domain .com')).toBe(false);
    });
  });

  describe('formatRecipient', () => {
    it('should format recipient with name', () => {
      const recipient: EmailRecipient = { email: 'test@example.com', name: 'Test User' };
      expect(formatRecipient(recipient)).toBe('Test User <test@example.com>');
    });

    it('should format recipient without name', () => {
      const recipient: EmailRecipient = { email: 'test@example.com' };
      expect(formatRecipient(recipient)).toBe('test@example.com');
    });

    it('should handle empty name', () => {
      const recipient: EmailRecipient = { email: 'test@example.com', name: '' };
      expect(formatRecipient(recipient)).toBe('test@example.com');
    });
  });
});

describe('Email Type Interfaces', () => {
  describe('EmailRecipient interface', () => {
    it('should allow email only', () => {
      const recipient: EmailRecipient = { email: 'test@example.com' };
      expect(recipient.email).toBe('test@example.com');
      expect(recipient.name).toBeUndefined();
    });

    it('should allow email with name', () => {
      const recipient: EmailRecipient = { email: 'test@example.com', name: 'Test User' };
      expect(recipient.email).toBe('test@example.com');
      expect(recipient.name).toBe('Test User');
    });
  });
});
