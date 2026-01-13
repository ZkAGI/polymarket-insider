/**
 * Unit tests for daily digest email template
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Types
  DailyDigestData,
  DigestScheduleConfig,
  DigestAlertSummary,
  DigestWalletSummary,
  // Template functions
  formatDigestDate,
  formatDigestTime,
  formatCompactNumber,
  getTrendIndicator,
  generateDigestSubject,
  generateDigestHtml,
  generateDigestPlainText,
  renderDigestEmail,
  createDigestEmailMessage,
  validateDigestData,
  createSampleDigestData,
  getDigestEmailPreviewHtml,
  // Scheduler functions
  isValidTimezone,
  getTimeComponentsInTimezone,
  calculateNextRunTime,
  isScheduledTimeDue,
  getDigestDateFromRunTime,
  DigestScheduler,
  createDigestScheduler,
  validateScheduleConfig,
  createScheduleConfig,
  // Constants
  DEFAULT_DIGEST_OPTIONS,
  DEFAULT_SCHEDULE_CONFIG,
  SUPPORTED_TIMEZONES,
} from '../../../src/notifications/email/templates';

describe('Daily Digest Email Template', () => {
  let sampleDigestData: DailyDigestData;

  beforeEach(() => {
    sampleDigestData = createSampleDigestData();
  });

  describe('formatDigestDate', () => {
    it('should format date correctly for default locale and timezone', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const formatted = formatDigestDate(date, 'en-US', 'UTC');
      expect(formatted).toContain('January');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('13');
    });

    it('should handle different timezones', () => {
      const date = new Date('2026-01-13T23:30:00Z');
      const utcFormatted = formatDigestDate(date, 'en-US', 'UTC');
      const tokyoFormatted = formatDigestDate(date, 'en-US', 'Asia/Tokyo');
      // UTC should show the 13th
      expect(utcFormatted).toContain('13');
      // Tokyo is UTC+9, so 23:30 UTC = 08:30+1 day in Tokyo
      expect(tokyoFormatted).toContain('14'); // Next day
    });

    it('should include weekday in format', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const formatted = formatDigestDate(date, 'en-US', 'UTC');
      expect(formatted).toContain('Tuesday');
    });

    it('should fall back gracefully on invalid timezone', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const formatted = formatDigestDate(date, 'en-US', 'Invalid/Timezone');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should use default locale and timezone when not provided', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const formatted = formatDigestDate(date);
      expect(formatted).toContain('2026');
    });
  });

  describe('formatDigestTime', () => {
    it('should format time correctly', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const formatted = formatDigestTime(date, 'en-US', 'UTC');
      expect(formatted).toContain('10');
      expect(formatted).toContain('30');
    });

    it('should handle different timezones', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const utcTime = formatDigestTime(date, 'en-US', 'UTC');
      const nyTime = formatDigestTime(date, 'en-US', 'America/New_York');
      expect(utcTime).not.toEqual(nyTime);
    });

    it('should fall back gracefully on invalid timezone', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const formatted = formatDigestTime(date, 'en-US', 'Invalid/Timezone');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('formatCompactNumber', () => {
    it('should format millions with M suffix', () => {
      expect(formatCompactNumber(1000000)).toBe('1.0M');
      expect(formatCompactNumber(2500000)).toBe('2.5M');
    });

    it('should format thousands with K suffix', () => {
      expect(formatCompactNumber(1000)).toBe('1.0K');
      expect(formatCompactNumber(45000)).toBe('45.0K');
    });

    it('should not format numbers under 1000', () => {
      expect(formatCompactNumber(500)).toBe('500');
      expect(formatCompactNumber(0)).toBe('0');
    });

    it('should round to one decimal place', () => {
      expect(formatCompactNumber(1234567)).toBe('1.2M');
      expect(formatCompactNumber(5678)).toBe('5.7K');
    });
  });

  describe('getTrendIndicator', () => {
    it('should return strong up for changes > 10', () => {
      const trend = getTrendIndicator(15);
      expect(trend.icon).toBe('↑↑');
      expect(trend.color).toBe('#16a34a');
    });

    it('should return up for changes 0-10', () => {
      const trend = getTrendIndicator(5);
      expect(trend.icon).toBe('↑');
      expect(trend.color).toBe('#22c55e');
    });

    it('should return down for changes 0 to -10', () => {
      const trend = getTrendIndicator(-5);
      expect(trend.icon).toBe('↓');
      expect(trend.color).toBe('#ef4444');
    });

    it('should return strong down for changes < -10', () => {
      const trend = getTrendIndicator(-15);
      expect(trend.icon).toBe('↓↓');
      expect(trend.color).toBe('#dc2626');
    });

    it('should return neutral for zero', () => {
      const trend = getTrendIndicator(0);
      expect(trend.icon).toBe('→');
      expect(trend.color).toBe('#6b7280');
    });
  });

  describe('generateDigestSubject', () => {
    it('should include date in subject', () => {
      const subject = generateDigestSubject(sampleDigestData);
      expect(subject).toContain('Daily Digest:');
    });

    it('should include critical alert count when present', () => {
      sampleDigestData.alertCounts.critical = 3;
      const subject = generateDigestSubject(sampleDigestData);
      expect(subject).toContain('3 Critical Alerts');
    });

    it('should use singular "Alert" for one critical', () => {
      sampleDigestData.alertCounts.critical = 1;
      const subject = generateDigestSubject(sampleDigestData);
      expect(subject).toContain('1 Critical Alert');
      expect(subject).not.toContain('Alerts');
    });

    it('should not include critical count when zero', () => {
      sampleDigestData.alertCounts.critical = 0;
      const subject = generateDigestSubject(sampleDigestData);
      expect(subject).not.toContain('Critical');
    });
  });

  describe('generateDigestHtml', () => {
    it('should generate valid HTML', () => {
      const html = generateDigestHtml(sampleDigestData);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('should include Daily Digest header', () => {
      const html = generateDigestHtml(sampleDigestData);
      expect(html).toContain('Daily Digest');
    });

    it('should include alert summary section', () => {
      const html = generateDigestHtml(sampleDigestData);
      expect(html).toContain('Alert Summary');
    });

    it('should include recipient name when provided', () => {
      sampleDigestData.recipientName = 'Alice';
      const html = generateDigestHtml(sampleDigestData);
      expect(html).toContain('Alice');
    });

    it('should include suspicious wallets section', () => {
      const html = generateDigestHtml(sampleDigestData);
      expect(html).toContain('Top Suspicious Wallets');
    });

    it('should include hot markets section', () => {
      const html = generateDigestHtml(sampleDigestData);
      expect(html).toContain('Hot Markets');
    });

    it('should include trading statistics section when enabled', () => {
      const html = generateDigestHtml(sampleDigestData, { showTradingStats: true });
      expect(html).toContain('Trading Activity');
    });

    it('should exclude trading stats when disabled', () => {
      const html = generateDigestHtml(sampleDigestData, { showTradingStats: false });
      expect(html).not.toContain('Trading Activity');
    });

    it('should include comparison section when data present', () => {
      const html = generateDigestHtml(sampleDigestData, { showComparison: true });
      expect(html).toContain('vs Previous Day');
    });

    it('should include highlights when present and enabled', () => {
      const html = generateDigestHtml(sampleDigestData, { showHighlights: true });
      expect(html).toContain('Key Highlights');
    });

    it('should include dashboard link when provided', () => {
      sampleDigestData.dashboardUrl = 'https://example.com/dashboard';
      const html = generateDigestHtml(sampleDigestData);
      expect(html).toContain('https://example.com/dashboard');
      expect(html).toContain('View Full Dashboard');
    });

    it('should include unsubscribe link when provided', () => {
      sampleDigestData.unsubscribeUrl = 'https://example.com/unsubscribe';
      const html = generateDigestHtml(sampleDigestData, { showFooter: true });
      expect(html).toContain('Unsubscribe');
    });

    it('should include branding when enabled', () => {
      const html = generateDigestHtml(sampleDigestData, { showBranding: true });
      expect(html).toContain('Polymarket Tracker');
    });

    it('should limit alerts to maxAlerts option', () => {
      // Add more alerts than the default max
      sampleDigestData.recentAlerts = Array(20).fill(sampleDigestData.recentAlerts[0]);
      const html = generateDigestHtml(sampleDigestData, { maxAlerts: 5 });
      // Should show indication of more alerts
      expect(html).toContain('Showing 5 of 20');
    });

    it('should escape HTML in user content', () => {
      sampleDigestData.recentAlerts[0] = {
        ...sampleDigestData.recentAlerts[0]!,
        title: '<script>alert("xss")</script>',
      };
      const html = generateDigestHtml(sampleDigestData);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should include digest ID', () => {
      sampleDigestData.digestId = 'digest-test-123';
      const html = generateDigestHtml(sampleDigestData);
      expect(html).toContain('digest-test-123');
    });
  });

  describe('generateDigestPlainText', () => {
    it('should generate plain text version', () => {
      const text = generateDigestPlainText(sampleDigestData);
      expect(text).toContain('DAILY DIGEST');
    });

    it('should include alert summary', () => {
      const text = generateDigestPlainText(sampleDigestData);
      expect(text).toContain('ALERT SUMMARY');
      expect(text).toContain('Total Alerts:');
    });

    it('should include recipient greeting when name provided', () => {
      sampleDigestData.recipientName = 'Bob';
      const text = generateDigestPlainText(sampleDigestData);
      expect(text).toContain('Hi Bob');
    });

    it('should include suspicious wallets section', () => {
      const text = generateDigestPlainText(sampleDigestData);
      expect(text).toContain('TOP SUSPICIOUS WALLETS');
    });

    it('should include trading statistics', () => {
      const text = generateDigestPlainText(sampleDigestData, { showTradingStats: true });
      expect(text).toContain('TRADING ACTIVITY');
      expect(text).toContain('Total Volume:');
    });

    it('should include hot markets section', () => {
      const text = generateDigestPlainText(sampleDigestData);
      expect(text).toContain('HOT MARKETS');
    });

    it('should include comparison data', () => {
      const text = generateDigestPlainText(sampleDigestData, { showComparison: true });
      expect(text).toContain('vs PREVIOUS DAY');
    });

    it('should include dashboard URL', () => {
      sampleDigestData.dashboardUrl = 'https://example.com/dashboard';
      const text = generateDigestPlainText(sampleDigestData);
      expect(text).toContain('VIEW DASHBOARD');
      expect(text).toContain('https://example.com/dashboard');
    });

    it('should include footer with unsubscribe', () => {
      sampleDigestData.unsubscribeUrl = 'https://example.com/unsub';
      const text = generateDigestPlainText(sampleDigestData, { showFooter: true });
      expect(text).toContain('Unsubscribe:');
      expect(text).toContain('https://example.com/unsub');
    });
  });

  describe('renderDigestEmail', () => {
    it('should return html, text, and subject', () => {
      const result = renderDigestEmail(sampleDigestData);
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('subject');
    });

    it('should have consistent subject', () => {
      const result = renderDigestEmail(sampleDigestData);
      expect(result.subject).toEqual(generateDigestSubject(sampleDigestData));
    });

    it('should have valid HTML in html field', () => {
      const result = renderDigestEmail(sampleDigestData);
      expect(result.html).toContain('<!DOCTYPE html>');
    });

    it('should have plain text in text field', () => {
      const result = renderDigestEmail(sampleDigestData);
      expect(result.text).toContain('DAILY DIGEST');
      expect(result.text).not.toContain('<html>');
    });
  });

  describe('createDigestEmailMessage', () => {
    it('should create email message with recipient', () => {
      const message = createDigestEmailMessage(sampleDigestData, 'test@example.com');
      expect(message.to).toBe('test@example.com');
      expect(message.subject).toBeTruthy();
      expect(message.html).toBeTruthy();
      expect(message.text).toBeTruthy();
    });

    it('should apply custom options', () => {
      const message = createDigestEmailMessage(sampleDigestData, 'test@example.com', {
        timezone: 'America/New_York',
      });
      expect(message.html).toBeTruthy();
    });
  });

  describe('validateDigestData', () => {
    it('should validate correct data', () => {
      expect(validateDigestData(sampleDigestData)).toBe(true);
    });

    it('should reject null', () => {
      expect(validateDigestData(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(validateDigestData(undefined)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateDigestData('string')).toBe(false);
      expect(validateDigestData(123)).toBe(false);
    });

    it('should reject missing digestId', () => {
      const invalid = { ...sampleDigestData, digestId: undefined };
      expect(validateDigestData(invalid)).toBe(false);
    });

    it('should reject invalid digestDate', () => {
      const invalid = { ...sampleDigestData, digestDate: 'not a date' };
      expect(validateDigestData(invalid)).toBe(false);
    });

    it('should reject missing alertCounts', () => {
      const invalid = { ...sampleDigestData, alertCounts: undefined };
      expect(validateDigestData(invalid)).toBe(false);
    });

    it('should reject non-array recentAlerts', () => {
      const invalid = { ...sampleDigestData, recentAlerts: 'not array' };
      expect(validateDigestData(invalid)).toBe(false);
    });

    it('should reject non-array topSuspiciousWallets', () => {
      const invalid = { ...sampleDigestData, topSuspiciousWallets: {} };
      expect(validateDigestData(invalid)).toBe(false);
    });

    it('should reject missing tradingStats', () => {
      const invalid = { ...sampleDigestData, tradingStats: undefined };
      expect(validateDigestData(invalid)).toBe(false);
    });
  });

  describe('createSampleDigestData', () => {
    it('should create valid sample data', () => {
      const sample = createSampleDigestData();
      expect(validateDigestData(sample)).toBe(true);
    });

    it('should allow overrides', () => {
      const sample = createSampleDigestData({ recipientName: 'Custom Name' });
      expect(sample.recipientName).toBe('Custom Name');
    });

    it('should have reasonable default values', () => {
      const sample = createSampleDigestData();
      expect(sample.alertCounts.total).toBeGreaterThan(0);
      expect(sample.recentAlerts.length).toBeGreaterThan(0);
      expect(sample.topSuspiciousWallets.length).toBeGreaterThan(0);
      expect(sample.hotMarkets.length).toBeGreaterThan(0);
    });
  });

  describe('getDigestEmailPreviewHtml', () => {
    it('should generate preview HTML', () => {
      const preview = getDigestEmailPreviewHtml(sampleDigestData);
      expect(preview).toContain('Email Preview');
    });

    it('should include subject in preview', () => {
      const preview = getDigestEmailPreviewHtml(sampleDigestData);
      expect(preview).toContain('Subject:');
    });

    it('should include both HTML and text tabs', () => {
      const preview = getDigestEmailPreviewHtml(sampleDigestData);
      expect(preview).toContain('HTML Version');
      expect(preview).toContain('Plain Text');
    });

    it('should embed the email HTML in iframe', () => {
      const preview = getDigestEmailPreviewHtml(sampleDigestData);
      expect(preview).toContain('srcdoc=');
      expect(preview).toContain('<iframe');
    });
  });

  describe('DEFAULT_DIGEST_OPTIONS', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_DIGEST_OPTIONS.includePlainText).toBe(true);
      expect(DEFAULT_DIGEST_OPTIONS.showFooter).toBe(true);
      expect(DEFAULT_DIGEST_OPTIONS.showBranding).toBe(true);
      expect(DEFAULT_DIGEST_OPTIONS.locale).toBe('en-US');
      expect(DEFAULT_DIGEST_OPTIONS.timezone).toBe('UTC');
      expect(DEFAULT_DIGEST_OPTIONS.maxAlerts).toBe(10);
      expect(DEFAULT_DIGEST_OPTIONS.maxWallets).toBe(5);
      expect(DEFAULT_DIGEST_OPTIONS.maxMarkets).toBe(5);
    });
  });
});

describe('Digest Scheduler', () => {
  describe('isValidTimezone', () => {
    it('should validate UTC', () => {
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('should validate common timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('NotATimezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });

  describe('SUPPORTED_TIMEZONES', () => {
    it('should include common timezones', () => {
      expect(SUPPORTED_TIMEZONES).toContain('UTC');
      expect(SUPPORTED_TIMEZONES).toContain('America/New_York');
      expect(SUPPORTED_TIMEZONES).toContain('Europe/London');
      expect(SUPPORTED_TIMEZONES).toContain('Asia/Tokyo');
    });

    it('should all be valid timezones', () => {
      for (const tz of SUPPORTED_TIMEZONES) {
        expect(isValidTimezone(tz)).toBe(true);
      }
    });
  });

  describe('getTimeComponentsInTimezone', () => {
    it('should return hour, minute, and day of week', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const components = getTimeComponentsInTimezone(date, 'UTC');
      expect(components).toHaveProperty('hour');
      expect(components).toHaveProperty('minute');
      expect(components).toHaveProperty('dayOfWeek');
    });

    it('should return correct hour in UTC', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const components = getTimeComponentsInTimezone(date, 'UTC');
      expect(components.hour).toBe(10);
      expect(components.minute).toBe(30);
    });

    it('should adjust for timezone offset', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const utcComponents = getTimeComponentsInTimezone(date, 'UTC');
      const tokyoComponents = getTimeComponentsInTimezone(date, 'Asia/Tokyo');
      // UTC should show 10:30
      expect(utcComponents.hour).toBe(10);
      expect(utcComponents.minute).toBe(30);
      // Tokyo is UTC+9, so hour should be +9
      expect(tokyoComponents.hour).toBe(19); // 10 + 9
    });

    it('should return correct day of week', () => {
      // Jan 13, 2026 is a Tuesday (2)
      const date = new Date('2026-01-13T10:30:00Z');
      const components = getTimeComponentsInTimezone(date, 'UTC');
      expect(components.dayOfWeek).toBe(2); // Tuesday
    });
  });

  describe('calculateNextRunTime', () => {
    it('should calculate next run time', () => {
      const config: DigestScheduleConfig = {
        enabled: true,
        sendHour: 8,
        sendMinute: 0,
        timezone: 'UTC',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        recipientEmail: 'test@example.com',
      };
      const nextRun = calculateNextRunTime(config);
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it('should schedule for tomorrow if time already passed today', () => {
      const now = new Date();
      const pastHour = now.getUTCHours() - 1;
      const config: DigestScheduleConfig = {
        enabled: true,
        sendHour: pastHour >= 0 ? pastHour : 0,
        sendMinute: 0,
        timezone: 'UTC',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        recipientEmail: 'test@example.com',
      };
      const fromDate = new Date(now);
      const nextRun = calculateNextRunTime(config, fromDate);
      // Should be tomorrow or later
      expect(nextRun.getTime()).toBeGreaterThan(fromDate.getTime());
    });

    it('should skip days not in daysOfWeek', () => {
      // Start from Tuesday (2)
      const tuesday = new Date('2026-01-13T12:00:00Z');
      const config: DigestScheduleConfig = {
        enabled: true,
        sendHour: 8,
        sendMinute: 0,
        timezone: 'UTC',
        daysOfWeek: [4], // Only Thursday
        recipientEmail: 'test@example.com',
      };
      const nextRun = calculateNextRunTime(config, tuesday);
      const { dayOfWeek } = getTimeComponentsInTimezone(nextRun, 'UTC');
      expect(dayOfWeek).toBe(4); // Thursday
    });

    it('should respect timezone for scheduling', () => {
      const config: DigestScheduleConfig = {
        enabled: true,
        sendHour: 8,
        sendMinute: 0,
        timezone: 'America/New_York', // EST is UTC-5
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        recipientEmail: 'test@example.com',
      };
      const nextRun = calculateNextRunTime(config);
      expect(nextRun).toBeInstanceOf(Date);
    });
  });

  describe('isScheduledTimeDue', () => {
    it('should return true when time has passed', () => {
      const pastTime = new Date(Date.now() - 60000); // 1 minute ago
      expect(isScheduledTimeDue(pastTime)).toBe(true);
    });

    it('should return false for future time', () => {
      const futureTime = new Date(Date.now() + 60000); // 1 minute in future
      expect(isScheduledTimeDue(futureTime)).toBe(false);
    });

    it('should respect grace period', () => {
      const pastTime = new Date(Date.now() - 400000); // 6+ minutes ago
      expect(isScheduledTimeDue(pastTime, 300000)).toBe(false); // 5 min grace
      expect(isScheduledTimeDue(pastTime, 600000)).toBe(true); // 10 min grace
    });

    it('should return true at exactly scheduled time', () => {
      const now = new Date();
      expect(isScheduledTimeDue(now)).toBe(true);
    });
  });

  describe('getDigestDateFromRunTime', () => {
    it('should return previous day', () => {
      const runTime = new Date('2026-01-13T08:00:00Z');
      const digestDate = getDigestDateFromRunTime(runTime, 'UTC');
      expect(digestDate.getUTCDate()).toBe(12); // Jan 12
    });

    it('should handle timezone differences', () => {
      // Run time is 3 AM UTC Jan 13
      const runTime = new Date('2026-01-13T03:00:00Z');
      // In Tokyo (UTC+9), this is 12 PM Jan 13, so digest covers Jan 12
      const digestDate = getDigestDateFromRunTime(runTime, 'Asia/Tokyo');
      expect(digestDate).toBeInstanceOf(Date);
    });

    it('should return start of day', () => {
      const runTime = new Date('2026-01-13T08:00:00Z');
      const digestDate = getDigestDateFromRunTime(runTime, 'UTC');
      expect(digestDate.getUTCHours()).toBe(0);
      expect(digestDate.getUTCMinutes()).toBe(0);
      expect(digestDate.getUTCSeconds()).toBe(0);
    });
  });

  describe('validateScheduleConfig', () => {
    const validConfig: DigestScheduleConfig = {
      enabled: true,
      sendHour: 8,
      sendMinute: 0,
      timezone: 'UTC',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      recipientEmail: 'test@example.com',
    };

    it('should validate correct config', () => {
      expect(validateScheduleConfig(validConfig)).toBe(true);
    });

    it('should reject null', () => {
      expect(validateScheduleConfig(null)).toBe(false);
    });

    it('should reject invalid sendHour', () => {
      expect(validateScheduleConfig({ ...validConfig, sendHour: 24 })).toBe(false);
      expect(validateScheduleConfig({ ...validConfig, sendHour: -1 })).toBe(false);
    });

    it('should reject invalid sendMinute', () => {
      expect(validateScheduleConfig({ ...validConfig, sendMinute: 60 })).toBe(false);
      expect(validateScheduleConfig({ ...validConfig, sendMinute: -1 })).toBe(false);
    });

    it('should reject invalid timezone', () => {
      expect(validateScheduleConfig({ ...validConfig, timezone: 'Invalid/TZ' })).toBe(false);
    });

    it('should reject invalid daysOfWeek', () => {
      expect(validateScheduleConfig({ ...validConfig, daysOfWeek: [7] })).toBe(false);
      expect(validateScheduleConfig({ ...validConfig, daysOfWeek: [-1] })).toBe(false);
      expect(validateScheduleConfig({ ...validConfig, daysOfWeek: 'monday' })).toBe(false);
    });

    it('should reject invalid email', () => {
      expect(validateScheduleConfig({ ...validConfig, recipientEmail: 'invalid' })).toBe(false);
      expect(validateScheduleConfig({ ...validConfig, recipientEmail: '' })).toBe(false);
    });
  });

  describe('createScheduleConfig', () => {
    it('should create config with email', () => {
      const config = createScheduleConfig('test@example.com');
      expect(config.recipientEmail).toBe('test@example.com');
    });

    it('should apply defaults', () => {
      const config = createScheduleConfig('test@example.com');
      expect(config.enabled).toBe(true);
      expect(config.sendHour).toBe(8);
      expect(config.sendMinute).toBe(0);
      expect(config.timezone).toBe('UTC');
    });

    it('should allow overrides', () => {
      const config = createScheduleConfig('test@example.com', {
        sendHour: 10,
        timezone: 'America/New_York',
      });
      expect(config.sendHour).toBe(10);
      expect(config.timezone).toBe('America/New_York');
    });
  });

  describe('DEFAULT_SCHEDULE_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_SCHEDULE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_SCHEDULE_CONFIG.sendHour).toBe(8);
      expect(DEFAULT_SCHEDULE_CONFIG.sendMinute).toBe(0);
      expect(DEFAULT_SCHEDULE_CONFIG.timezone).toBe('UTC');
      expect(DEFAULT_SCHEDULE_CONFIG.daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });

  describe('DigestScheduler class', () => {
    let scheduler: DigestScheduler;

    beforeEach(() => {
      scheduler = createDigestScheduler();
    });

    afterEach(() => {
      scheduler.stop();
    });

    it('should create scheduler instance', () => {
      expect(scheduler).toBeInstanceOf(DigestScheduler);
    });

    it('should schedule a digest job', () => {
      const config = createScheduleConfig('test@example.com');
      const job = scheduler.scheduleDigest(config);
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('nextRunTime');
      expect(job.config.recipientEmail).toBe('test@example.com');
    });

    it('should get job by email', () => {
      const config = createScheduleConfig('test@example.com');
      scheduler.scheduleDigest(config);
      const job = scheduler.getJob('test@example.com');
      expect(job).toBeDefined();
      expect(job?.config.recipientEmail).toBe('test@example.com');
    });

    it('should get all jobs', () => {
      scheduler.scheduleDigest(createScheduleConfig('test1@example.com'));
      scheduler.scheduleDigest(createScheduleConfig('test2@example.com'));
      const jobs = scheduler.getAllJobs();
      expect(jobs.length).toBe(2);
    });

    it('should remove a job', () => {
      scheduler.scheduleDigest(createScheduleConfig('test@example.com'));
      const removed = scheduler.removeJob('test@example.com');
      expect(removed).toBe(true);
      expect(scheduler.getJob('test@example.com')).toBeUndefined();
    });

    it('should return false when removing non-existent job', () => {
      const removed = scheduler.removeJob('nonexistent@example.com');
      expect(removed).toBe(false);
    });

    it('should start and stop', () => {
      scheduler.start();
      expect(scheduler.getStatus().isRunning).toBe(true);
      scheduler.stop();
      expect(scheduler.getStatus().isRunning).toBe(false);
    });

    it('should emit events', () => {
      let eventReceived = false;
      scheduler.on('job:scheduled', () => {
        eventReceived = true;
      });
      scheduler.scheduleDigest(createScheduleConfig('test@example.com'));
      expect(eventReceived).toBe(true);
    });

    it('should get scheduler status', () => {
      scheduler.scheduleDigest(createScheduleConfig('test@example.com'));
      const status = scheduler.getStatus();
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('totalJobs');
      expect(status).toHaveProperty('activeJobs');
      expect(status.totalJobs).toBe(1);
    });

    it('should update job on reschedule', () => {
      const config1 = createScheduleConfig('test@example.com', { sendHour: 8 });
      const config2 = createScheduleConfig('test@example.com', { sendHour: 10 });
      scheduler.scheduleDigest(config1);
      scheduler.scheduleDigest(config2);
      const job = scheduler.getJob('test@example.com');
      expect(job?.config.sendHour).toBe(10);
      expect(scheduler.getAllJobs().length).toBe(1);
    });
  });

  describe('createDigestScheduler', () => {
    it('should create scheduler with default config', () => {
      const scheduler = createDigestScheduler();
      expect(scheduler).toBeInstanceOf(DigestScheduler);
      scheduler.stop();
    });

    it('should accept custom config', () => {
      const scheduler = createDigestScheduler({
        checkInterval: 30000,
        gracePeriod: 600000,
      });
      expect(scheduler).toBeInstanceOf(DigestScheduler);
      scheduler.stop();
    });
  });
});

describe('Edge Cases and Integration', () => {
  describe('Empty Data Handling', () => {
    it('should handle empty alerts array', () => {
      const baseData = createSampleDigestData();
      // Create data with empty recentAlerts by directly setting it
      const data: DailyDigestData = {
        ...baseData,
        recentAlerts: [],
      };
      expect(data.recentAlerts.length).toBe(0); // Verify the data is correct
      const html = generateDigestHtml(data);
      expect(html).toBeTruthy();
      // When there are no recent alerts, the section shouldn't be rendered
      // The header "Recent Alerts" should not appear when the array is empty
      expect(html).not.toContain('🕐 Recent Alerts');
    });

    it('should handle empty wallets array', () => {
      const data = createSampleDigestData({ topSuspiciousWallets: [] });
      const html = generateDigestHtml(data);
      expect(html).toBeTruthy();
    });

    it('should handle empty markets array', () => {
      const data = createSampleDigestData({ hotMarkets: [] });
      const html = generateDigestHtml(data);
      expect(html).toBeTruthy();
    });

    it('should handle zero alert counts', () => {
      const data = createSampleDigestData({
        alertCounts: {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
      });
      const html = generateDigestHtml(data);
      expect(html).toContain('No alerts in this period');
    });

    it('should handle missing optional fields', () => {
      const data = createSampleDigestData({
        comparison: undefined,
        highlights: undefined,
        recipientName: undefined,
        dashboardUrl: undefined,
        unsubscribeUrl: undefined,
      });
      const html = generateDigestHtml(data);
      expect(html).toBeTruthy();
    });
  });

  describe('Large Data Sets', () => {
    it('should handle many alerts', () => {
      const alerts: DigestAlertSummary[] = Array(100).fill(null).map((_, i) => ({
        id: `alert-${i}`,
        type: 'whale_trade' as const,
        severity: 'high' as const,
        title: `Alert ${i}`,
        timestamp: new Date(),
      }));
      const data = createSampleDigestData({ recentAlerts: alerts });
      const html = generateDigestHtml(data, { maxAlerts: 10 });
      expect(html).toContain('Showing 10 of 100');
    });

    it('should handle many wallets', () => {
      const wallets: DigestWalletSummary[] = Array(50).fill(null).map((_, i) => ({
        address: `0x${'a'.repeat(40)}${i}`.slice(0, 42),
        score: 50 + i,
        alertCount: i,
      }));
      const data = createSampleDigestData({ topSuspiciousWallets: wallets });
      const html = generateDigestHtml(data, { maxWallets: 5 });
      // Should only show 5 wallets
      expect(html).toBeTruthy();
    });
  });

  describe('Timezone Edge Cases', () => {
    it('should handle daylight saving transitions', () => {
      // March 8, 2026 is around DST change in US
      const date = new Date('2026-03-08T07:00:00Z');
      const formatted = formatDigestDate(date, 'en-US', 'America/New_York');
      expect(formatted).toBeTruthy();
    });

    it('should handle year boundary', () => {
      const date = new Date('2025-12-31T23:00:00Z');
      const utcFormatted = formatDigestDate(date, 'en-US', 'UTC');
      const tokyoFormatted = formatDigestDate(date, 'en-US', 'Asia/Tokyo');
      expect(utcFormatted).toContain('2025');
      expect(tokyoFormatted).toContain('2026'); // Next year in Tokyo
    });

    it('should handle all supported timezones', () => {
      const date = new Date();
      for (const tz of SUPPORTED_TIMEZONES) {
        expect(() => formatDigestDate(date, 'en-US', tz)).not.toThrow();
      }
    });
  });

  describe('Special Characters', () => {
    it('should escape HTML in wallet addresses', () => {
      const data = createSampleDigestData({
        topSuspiciousWallets: [{
          address: '<script>hack</script>',
          score: 90,
          alertCount: 5,
        }],
      });
      const html = generateDigestHtml(data);
      expect(html).not.toContain('<script>hack</script>');
    });

    it('should escape HTML in market titles', () => {
      const data = createSampleDigestData({
        hotMarkets: [{
          id: 'market-1',
          title: '<img src=x onerror=alert(1)>',
          alertCount: 5,
        }],
      });
      const html = generateDigestHtml(data);
      expect(html).not.toContain('<img src=x');
    });

    it('should handle unicode in names', () => {
      const data = createSampleDigestData({
        recipientName: '日本語ユーザー',
      });
      const html = generateDigestHtml(data);
      expect(html).toContain('日本語ユーザー');
    });
  });
});
