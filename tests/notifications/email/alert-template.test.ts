/**
 * Unit tests for alert email template
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderAlertEmail,
  generateAlertHtml,
  generateAlertPlainText,
  generateSubject,
  createAlertEmailMessage,
  validateAlertTemplateData,
  formatEmailDate,
  formatCurrency,
  formatPercentage,
  truncateAddress,
  escapeHtml,
  getSeverityLabel,
  getSeverityColors,
  getAlertTypeConfig,
  getAlertEmailPreviewHtml,
  SEVERITY_COLORS,
  ALERT_TYPE_CONFIG,
  AlertTemplateData,
  AlertSeverity,
  AlertType,
} from '../../../src/notifications/email/templates';

describe('Alert Email Template', () => {
  // Sample alert data for testing
  let sampleAlertData: AlertTemplateData;

  beforeEach(() => {
    sampleAlertData = {
      alertId: 'alert_123abc',
      alertType: 'whale_trade',
      severity: 'high',
      title: 'Large Whale Trade Detected',
      message: 'A significant whale trade of $500,000 has been detected on the US Election 2024 market.',
      timestamp: new Date('2026-01-13T10:30:00Z'),
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      marketId: 'market_456',
      marketTitle: 'Will Trump win the 2024 US Presidential Election?',
      tradeSize: 500000,
      priceChange: 5.25,
      suspicionScore: 75,
      actionUrl: 'https://polymarket-tracker.com/alerts/alert_123abc',
      dashboardUrl: 'https://polymarket-tracker.com/dashboard',
      recipientName: 'John',
      unsubscribeUrl: 'https://polymarket-tracker.com/unsubscribe',
    };
  });

  describe('formatEmailDate', () => {
    it('should format date correctly for default locale and timezone', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const formatted = formatEmailDate(date, 'en-US', 'UTC');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('10:30');
    });

    it('should handle different timezones', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const utcFormatted = formatEmailDate(date, 'en-US', 'UTC');
      const estFormatted = formatEmailDate(date, 'en-US', 'America/New_York');
      expect(utcFormatted).not.toEqual(estFormatted);
    });

    it('should fall back to ISO format on invalid timezone', () => {
      const date = new Date('2026-01-13T10:30:00Z');
      const formatted = formatEmailDate(date, 'en-US', 'Invalid/Timezone');
      // Should still return something parseable
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000');
      expect(formatCurrency(1000.50)).toBe('$1,000.5');
      expect(formatCurrency(0)).toBe('$0');
    });

    it('should handle large numbers', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000');
      expect(formatCurrency(500000.75)).toBe('$500,000.75');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-1000)).toBe('-$1,000');
    });
  });

  describe('formatPercentage', () => {
    it('should format positive percentages with plus sign', () => {
      expect(formatPercentage(5.25)).toBe('+5.25%');
      expect(formatPercentage(0.5)).toBe('+0.50%');
    });

    it('should format negative percentages', () => {
      expect(formatPercentage(-3.75)).toBe('-3.75%');
    });

    it('should format zero', () => {
      expect(formatPercentage(0)).toBe('+0.00%');
    });
  });

  describe('truncateAddress', () => {
    it('should truncate long addresses', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      expect(truncateAddress(address)).toBe('0x1234...345678');
    });

    it('should use custom character count', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      expect(truncateAddress(address, 4)).toBe('0x12...5678');
    });

    it('should not truncate short addresses', () => {
      const address = '0x1234';
      expect(truncateAddress(address)).toBe('0x1234');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('"test"')).toBe('&quot;test&quot;');
      expect(escapeHtml("it's")).toBe("it&#39;s");
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should handle normal text', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('getSeverityLabel', () => {
    it('should return correct labels for all severities', () => {
      expect(getSeverityLabel('critical')).toBe('CRITICAL');
      expect(getSeverityLabel('high')).toBe('HIGH');
      expect(getSeverityLabel('medium')).toBe('MEDIUM');
      expect(getSeverityLabel('low')).toBe('LOW');
      expect(getSeverityLabel('info')).toBe('INFO');
    });
  });

  describe('getSeverityColors', () => {
    it('should return colors for all severities', () => {
      const severities: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
      severities.forEach(severity => {
        const colors = getSeverityColors(severity);
        expect(colors).toHaveProperty('background');
        expect(colors).toHaveProperty('text');
        expect(colors).toHaveProperty('border');
        expect(colors).toHaveProperty('icon');
        expect(colors.background).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe('getAlertTypeConfig', () => {
    it('should return config for all alert types', () => {
      const types: AlertType[] = [
        'whale_trade', 'price_movement', 'insider_activity', 'fresh_wallet',
        'wallet_reactivation', 'coordinated_activity', 'unusual_pattern',
        'market_resolved', 'new_market', 'suspicious_funding', 'sanctioned_activity', 'system'
      ];
      types.forEach(type => {
        const config = getAlertTypeConfig(type);
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('icon');
        expect(config).toHaveProperty('description');
        expect(typeof config.label).toBe('string');
        expect(typeof config.icon).toBe('string');
      });
    });
  });

  describe('SEVERITY_COLORS constant', () => {
    it('should have colors for all severity levels', () => {
      expect(SEVERITY_COLORS).toHaveProperty('critical');
      expect(SEVERITY_COLORS).toHaveProperty('high');
      expect(SEVERITY_COLORS).toHaveProperty('medium');
      expect(SEVERITY_COLORS).toHaveProperty('low');
      expect(SEVERITY_COLORS).toHaveProperty('info');
    });
  });

  describe('ALERT_TYPE_CONFIG constant', () => {
    it('should have config for all alert types', () => {
      expect(Object.keys(ALERT_TYPE_CONFIG)).toHaveLength(12);
      expect(ALERT_TYPE_CONFIG).toHaveProperty('whale_trade');
      expect(ALERT_TYPE_CONFIG).toHaveProperty('insider_activity');
    });
  });

  describe('generateSubject', () => {
    it('should generate correct subject for regular alert', () => {
      const subject = generateSubject(sampleAlertData);
      expect(subject).toBe('[HIGH] Whale Trade: Large Whale Trade Detected');
    });

    it('should add emoji prefix for critical alerts', () => {
      const criticalData = { ...sampleAlertData, severity: 'critical' as AlertSeverity };
      const subject = generateSubject(criticalData);
      expect(subject.startsWith('🚨 ')).toBe(true);
      expect(subject).toContain('[CRITICAL]');
    });

    it('should include alert type label', () => {
      const subject = generateSubject(sampleAlertData);
      expect(subject).toContain('Whale Trade');
    });
  });

  describe('generateAlertHtml', () => {
    it('should generate valid HTML', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('<body');
      expect(html).toContain('</body>');
    });

    it('should include alert title', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('Large Whale Trade Detected');
    });

    it('should include alert message', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('A significant whale trade of $500,000');
    });

    it('should include severity badge', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('HIGH');
    });

    it('should include alert type badge', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('Whale Trade');
      expect(html).toContain('🐋');
    });

    it('should include wallet address when provided', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('0x1234567890abcdef1234567890abcdef12345678');
    });

    it('should include market title when provided', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('Will Trump win the 2024 US Presidential Election?');
    });

    it('should format trade size as currency', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('$500,000');
    });

    it('should format price change as percentage', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('+5.25%');
    });

    it('should include suspicion score', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('75/100');
    });

    it('should include action button when URL provided', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('View Alert Details');
      expect(html).toContain('https://polymarket-tracker.com/alerts/alert_123abc');
    });

    it('should include dashboard link when URL provided', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('View Dashboard');
      expect(html).toContain('https://polymarket-tracker.com/dashboard');
    });

    it('should include recipient greeting when name provided', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('Hi John');
    });

    it('should include alert ID', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('alert_123abc');
    });

    it('should include unsubscribe link in footer', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('Unsubscribe');
      expect(html).toContain('https://polymarket-tracker.com/unsubscribe');
    });

    it('should include branding by default', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('Polymarket Tracker');
    });

    it('should hide footer when option disabled', () => {
      const html = generateAlertHtml(sampleAlertData, { showFooter: false });
      expect(html).not.toContain('Unsubscribe from alerts');
    });

    it('should hide branding when option disabled', () => {
      const html = generateAlertHtml(sampleAlertData, { showBranding: false });
      // Footer text should still be there but branding removed
      const footerBrandingPattern = /Powered by Polymarket Tracker/;
      expect(html).not.toMatch(footerBrandingPattern);
    });

    it('should escape HTML in user content', () => {
      const dataWithHtml = {
        ...sampleAlertData,
        title: '<script>alert("xss")</script>',
        message: 'Test <b>bold</b> & "quotes"',
      };
      const html = generateAlertHtml(dataWithHtml);
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;b&gt;');
      expect(html).toContain('&amp;');
    });

    it('should include dark mode styles', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('prefers-color-scheme: dark');
    });

    it('should include custom styles when provided', () => {
      const html = generateAlertHtml(sampleAlertData, { customStyles: '.custom { color: red; }' });
      expect(html).toContain('.custom { color: red; }');
    });

    it('should include custom metadata when provided', () => {
      const dataWithMetadata = {
        ...sampleAlertData,
        metadata: { 'Custom Field': 'Custom Value', 'Number Field': 123 },
      };
      const html = generateAlertHtml(dataWithMetadata);
      expect(html).toContain('Custom Field');
      expect(html).toContain('Custom Value');
      expect(html).toContain('123');
    });

    it('should use correct colors for different severities', () => {
      const severities: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
      severities.forEach(severity => {
        const data = { ...sampleAlertData, severity };
        const html = generateAlertHtml(data);
        const colors = SEVERITY_COLORS[severity];
        expect(html).toContain(colors.border);
      });
    });
  });

  describe('generateAlertPlainText', () => {
    it('should generate plain text output', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });

    it('should include severity header', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('[HIGH]');
    });

    it('should include alert title', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('Large Whale Trade Detected');
    });

    it('should include alert message', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('A significant whale trade of $500,000');
    });

    it('should include wallet address', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('0x1234567890abcdef1234567890abcdef12345678');
    });

    it('should include market title', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('Will Trump win the 2024 US Presidential Election?');
    });

    it('should include trade size', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('$500,000');
    });

    it('should include action URL', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('View Alert: https://polymarket-tracker.com/alerts/alert_123abc');
    });

    it('should include dashboard URL', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('Dashboard: https://polymarket-tracker.com/dashboard');
    });

    it('should include recipient greeting', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('Hi John');
    });

    it('should include alert ID', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('Alert ID: alert_123abc');
    });

    it('should include unsubscribe link', () => {
      const text = generateAlertPlainText(sampleAlertData);
      expect(text).toContain('Unsubscribe: https://polymarket-tracker.com/unsubscribe');
    });
  });

  describe('renderAlertEmail', () => {
    it('should return object with html, text, and subject', () => {
      const result = renderAlertEmail(sampleAlertData);
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('subject');
    });

    it('should have valid HTML content', () => {
      const result = renderAlertEmail(sampleAlertData);
      expect(result.html).toContain('<!DOCTYPE html>');
    });

    it('should have valid plain text content', () => {
      const result = renderAlertEmail(sampleAlertData);
      expect(result.text).toContain('[HIGH]');
    });

    it('should have correct subject', () => {
      const result = renderAlertEmail(sampleAlertData);
      expect(result.subject).toBe('[HIGH] Whale Trade: Large Whale Trade Detected');
    });

    it('should pass options to HTML generator', () => {
      const result = renderAlertEmail(sampleAlertData, { showFooter: false });
      expect(result.html).not.toContain('Unsubscribe from alerts');
    });
  });

  describe('createAlertEmailMessage', () => {
    it('should create email message object', () => {
      const message = createAlertEmailMessage(sampleAlertData, 'test@example.com');
      expect(message).toHaveProperty('to');
      expect(message).toHaveProperty('subject');
      expect(message).toHaveProperty('html');
      expect(message).toHaveProperty('text');
    });

    it('should set correct recipient', () => {
      const message = createAlertEmailMessage(sampleAlertData, 'test@example.com');
      expect(message.to).toBe('test@example.com');
    });

    it('should set correct subject', () => {
      const message = createAlertEmailMessage(sampleAlertData, 'test@example.com');
      expect(message.subject).toContain('[HIGH]');
    });

    it('should include both HTML and text versions', () => {
      const message = createAlertEmailMessage(sampleAlertData, 'test@example.com');
      expect(message.html).toContain('<!DOCTYPE html>');
      expect(message.text.length).toBeGreaterThan(0);
    });
  });

  describe('validateAlertTemplateData', () => {
    it('should return true for valid data', () => {
      expect(validateAlertTemplateData(sampleAlertData)).toBe(true);
    });

    it('should return false for null', () => {
      expect(validateAlertTemplateData(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(validateAlertTemplateData(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(validateAlertTemplateData('string')).toBe(false);
      expect(validateAlertTemplateData(123)).toBe(false);
    });

    it('should return false for missing alertId', () => {
      const data = { ...sampleAlertData };
      delete (data as Record<string, unknown>).alertId;
      expect(validateAlertTemplateData(data)).toBe(false);
    });

    it('should return false for empty alertId', () => {
      const data = { ...sampleAlertData, alertId: '' };
      expect(validateAlertTemplateData(data)).toBe(false);
    });

    it('should return false for invalid alertType', () => {
      const data = { ...sampleAlertData, alertType: 'invalid_type' };
      expect(validateAlertTemplateData(data)).toBe(false);
    });

    it('should return false for invalid severity', () => {
      const data = { ...sampleAlertData, severity: 'invalid_severity' };
      expect(validateAlertTemplateData(data)).toBe(false);
    });

    it('should return false for missing title', () => {
      const data = { ...sampleAlertData };
      delete (data as Record<string, unknown>).title;
      expect(validateAlertTemplateData(data)).toBe(false);
    });

    it('should return false for empty title', () => {
      const data = { ...sampleAlertData, title: '' };
      expect(validateAlertTemplateData(data)).toBe(false);
    });

    it('should return false for missing message', () => {
      const data = { ...sampleAlertData };
      delete (data as Record<string, unknown>).message;
      expect(validateAlertTemplateData(data)).toBe(false);
    });

    it('should return false for empty message', () => {
      const data = { ...sampleAlertData, message: '' };
      expect(validateAlertTemplateData(data)).toBe(false);
    });

    it('should return false for invalid timestamp', () => {
      const data = { ...sampleAlertData, timestamp: 'not a date' };
      expect(validateAlertTemplateData(data)).toBe(false);
    });

    it('should accept valid data with minimal fields', () => {
      const minimalData = {
        alertId: 'alert_min',
        alertType: 'whale_trade' as AlertType,
        severity: 'high' as AlertSeverity,
        title: 'Test Alert',
        message: 'Test message',
        timestamp: new Date(),
      };
      expect(validateAlertTemplateData(minimalData)).toBe(true);
    });
  });

  describe('getAlertEmailPreviewHtml', () => {
    it('should generate preview HTML', () => {
      const html = getAlertEmailPreviewHtml(sampleAlertData);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Email Preview');
    });

    it('should include tabs for HTML and plain text', () => {
      const html = getAlertEmailPreviewHtml(sampleAlertData);
      expect(html).toContain('HTML Version');
      expect(html).toContain('Plain Text');
    });

    it('should include iframe with email HTML', () => {
      const html = getAlertEmailPreviewHtml(sampleAlertData);
      expect(html).toContain('<iframe');
      expect(html).toContain('srcdoc=');
    });

    it('should include subject in preview', () => {
      const html = getAlertEmailPreviewHtml(sampleAlertData);
      expect(html).toContain('[HIGH] Whale Trade: Large Whale Trade Detected');
    });
  });

  describe('Edge cases', () => {
    it('should handle data without optional fields', () => {
      const minimalData: AlertTemplateData = {
        alertId: 'alert_min',
        alertType: 'system',
        severity: 'info',
        title: 'System Notification',
        message: 'This is a system message.',
        timestamp: new Date(),
      };

      const result = renderAlertEmail(minimalData);
      expect(result.html).toContain('System Notification');
      expect(result.text).toContain('System Notification');
      expect(result.subject).toContain('[INFO]');
    });

    it('should handle very long text content', () => {
      const longMessage = 'A'.repeat(10000);
      const data = { ...sampleAlertData, message: longMessage };
      const result = renderAlertEmail(data);
      expect(result.html).toContain(longMessage);
      expect(result.text).toContain(longMessage);
    });

    it('should handle special characters in all fields', () => {
      const data = {
        ...sampleAlertData,
        title: 'Alert <test> & "special" chars',
        message: 'Message with <script> and "quotes" & ampersands',
        marketTitle: "It's a test market <with> special chars",
        recipientName: 'John "The User" Doe',
      };

      const result = renderAlertEmail(data);
      expect(result.html).toContain('&lt;test&gt;');
      expect(result.html).toContain('&amp;');
      expect(result.html).toContain('&quot;');
    });

    it('should handle negative values', () => {
      const data = {
        ...sampleAlertData,
        tradeSize: -1000,
        priceChange: -15.5,
      };
      const html = generateAlertHtml(data);
      expect(html).toContain('-$1,000');
      expect(html).toContain('-15.50%');
    });

    it('should handle zero values', () => {
      const data = {
        ...sampleAlertData,
        tradeSize: 0,
        priceChange: 0,
        suspicionScore: 0,
      };
      const html = generateAlertHtml(data);
      expect(html).toContain('$0');
      expect(html).toContain('+0.00%');
      expect(html).toContain('0/100');
    });

    it('should handle all alert types', () => {
      const types: AlertType[] = [
        'whale_trade', 'price_movement', 'insider_activity', 'fresh_wallet',
        'wallet_reactivation', 'coordinated_activity', 'unusual_pattern',
        'market_resolved', 'new_market', 'suspicious_funding', 'sanctioned_activity', 'system'
      ];

      types.forEach(type => {
        const data = { ...sampleAlertData, alertType: type };
        const result = renderAlertEmail(data);
        expect(result.html.length).toBeGreaterThan(0);
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.subject.length).toBeGreaterThan(0);
      });
    });

    it('should handle all severity levels', () => {
      const severities: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

      severities.forEach(severity => {
        const data = { ...sampleAlertData, severity };
        const result = renderAlertEmail(data);
        expect(result.html).toContain(getSeverityLabel(severity));
        expect(result.text).toContain(`[${getSeverityLabel(severity)}]`);
      });
    });

    it('should handle URLs with special characters', () => {
      const data = {
        ...sampleAlertData,
        actionUrl: 'https://example.com/path?param=value&other=123',
        dashboardUrl: 'https://example.com/dash#section',
        unsubscribeUrl: 'https://example.com/unsub?token=abc123',
      };

      const html = generateAlertHtml(data);
      expect(html).toContain('param=value&amp;other=123');
    });
  });

  describe('Email client compatibility', () => {
    it('should use table-based layout for email clients', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('role="presentation"');
      expect(html).toContain('cellpadding="0"');
      expect(html).toContain('cellspacing="0"');
    });

    it('should include MSO conditionals for Outlook', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('<!--[if mso]>');
    });

    it('should use inline styles', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('style="');
    });

    it('should include viewport meta tag', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('name="viewport"');
    });

    it('should include charset meta tag', () => {
      const html = generateAlertHtml(sampleAlertData);
      expect(html).toContain('charset="UTF-8"');
    });
  });
});
