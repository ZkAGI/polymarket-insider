/**
 * E2E tests for alert email template
 * Tests the end-to-end rendering and email compatibility of alert templates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderAlertEmail,
  generateAlertHtml,
  generateAlertPlainText,
  createAlertEmailMessage,
  validateAlertTemplateData,
  SEVERITY_COLORS,
  ALERT_TYPE_CONFIG,
  AlertTemplateData,
  AlertSeverity,
  AlertType,
} from '../../src/notifications/email/templates';
import { createEmailClient } from '../../src/notifications/email';

describe('Alert Email Template E2E', () => {
  // Comprehensive sample data for E2E testing
  let sampleAlertData: AlertTemplateData;

  beforeEach(() => {
    sampleAlertData = {
      alertId: 'e2e_alert_001',
      alertType: 'whale_trade',
      severity: 'critical',
      title: 'Massive Whale Trade Detected',
      message:
        'A whale wallet (0x1234...5678) executed a massive $2.5M trade on the US Election 2024 market. This is the largest single trade in the past 7 days and moved the probability by 3.2%. The wallet has a history of accurate predictions with a 78% win rate.',
      timestamp: new Date('2026-01-13T14:30:00Z'),
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      marketId: 'market_election_2024',
      marketTitle: 'Will Trump win the 2024 US Presidential Election?',
      tradeSize: 2500000,
      priceChange: 3.2,
      suspicionScore: 85,
      actionUrl: 'https://polymarket-tracker.com/alerts/e2e_alert_001',
      dashboardUrl: 'https://polymarket-tracker.com/dashboard',
      baseUrl: 'https://polymarket-tracker.com',
      recipientName: 'Trading Analyst',
      unsubscribeUrl: 'https://polymarket-tracker.com/unsubscribe?token=abc123',
      metadata: {
        'Win Rate': '78%',
        'Previous Trades': 42,
        'Risk Level': 'Very High',
      },
    };
  });

  describe('Full Email Rendering Pipeline', () => {
    it('should render complete email with all components', () => {
      const result = renderAlertEmail(sampleAlertData);

      // Verify all three parts are generated
      expect(result.subject).toBeDefined();
      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();

      // Subject should have critical emoji prefix
      expect(result.subject).toContain('🚨');
      expect(result.subject).toContain('[CRITICAL]');
      expect(result.subject).toContain('Whale Trade');

      // HTML should contain all major sections
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('Massive Whale Trade Detected');
      expect(result.html).toContain('$2,500,000');
      expect(result.html).toContain('+3.20%');
      expect(result.html).toContain('85/100');
      expect(result.html).toContain('Trading Analyst');
      expect(result.html).toContain('Win Rate');

      // Plain text should be readable
      expect(result.text).toContain('[CRITICAL]');
      expect(result.text).toContain('Massive Whale Trade Detected');
      expect(result.text).toContain('View Alert:');
    });

    it('should generate valid email message object for sending', () => {
      const message = createAlertEmailMessage(
        sampleAlertData,
        'analyst@trading-firm.com',
        { showFooter: true, showBranding: true }
      );

      expect(message.to).toBe('analyst@trading-firm.com');
      expect(message.subject.length).toBeGreaterThan(0);
      expect(message.html.length).toBeGreaterThan(1000);
      expect(message.text.length).toBeGreaterThan(100);
    });
  });

  describe('All Alert Types Rendering', () => {
    const alertTypes: AlertType[] = [
      'whale_trade',
      'price_movement',
      'insider_activity',
      'fresh_wallet',
      'wallet_reactivation',
      'coordinated_activity',
      'unusual_pattern',
      'market_resolved',
      'new_market',
      'suspicious_funding',
      'sanctioned_activity',
      'system',
    ];

    alertTypes.forEach(alertType => {
      it(`should render ${alertType} alert correctly`, () => {
        const data: AlertTemplateData = {
          ...sampleAlertData,
          alertType,
          title: `Test ${ALERT_TYPE_CONFIG[alertType].label} Alert`,
          message: `This is a test message for ${alertType} alerts.`,
        };

        const result = renderAlertEmail(data);

        // Verify type label appears
        expect(result.html).toContain(ALERT_TYPE_CONFIG[alertType].label);
        expect(result.html).toContain(ALERT_TYPE_CONFIG[alertType].icon);

        // Subject should contain type
        expect(result.subject).toContain(ALERT_TYPE_CONFIG[alertType].label);

        // Plain text should be valid
        expect(result.text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('All Severity Levels Rendering', () => {
    const severities: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

    severities.forEach(severity => {
      it(`should render ${severity} severity with correct colors`, () => {
        const data: AlertTemplateData = {
          ...sampleAlertData,
          severity,
          title: `${severity.toUpperCase()} Alert Test`,
        };

        const result = renderAlertEmail(data);
        const colors = SEVERITY_COLORS[severity];

        // HTML should contain the severity colors
        expect(result.html).toContain(colors.background);
        expect(result.html).toContain(colors.border);

        // Subject should contain severity label
        expect(result.subject).toContain(`[${severity.toUpperCase()}]`);

        // Critical should have emoji prefix
        if (severity === 'critical') {
          expect(result.subject.startsWith('🚨')).toBe(true);
        }
      });
    });
  });

  describe('Email Client Compatibility', () => {
    it('should use email-safe HTML structure', () => {
      const html = generateAlertHtml(sampleAlertData);

      // Table-based layout for Outlook compatibility
      expect(html).toContain('<table');
      expect(html).toContain('role="presentation"');
      expect(html).toContain('cellpadding="0"');
      expect(html).toContain('cellspacing="0"');

      // Inline styles for Gmail compatibility
      expect(html).toContain('style="');

      // MSO conditionals for Outlook
      expect(html).toContain('<!--[if mso]>');

      // Viewport meta for mobile
      expect(html).toContain('name="viewport"');
    });

    it('should use hex colors instead of named colors', () => {
      const html = generateAlertHtml(sampleAlertData);

      // All colors should be hex
      const colorPattern = /#[0-9a-fA-F]{6}/g;
      const hexColors = html.match(colorPattern);
      expect(hexColors).not.toBeNull();
      expect(hexColors!.length).toBeGreaterThan(5);

      // Should not use color names in styles
      expect(html).not.toMatch(/style="[^"]*color:\s*red/i);
      expect(html).not.toMatch(/style="[^"]*background:\s*blue/i);
    });

    it('should provide fallback fonts', () => {
      const html = generateAlertHtml(sampleAlertData);

      // Font stack with web-safe fallbacks
      expect(html).toMatch(/font-family:[^;]*-apple-system/);
      expect(html).toMatch(/font-family:[^;]*Arial/);
      expect(html).toMatch(/font-family:[^;]*sans-serif/);
    });

    it('should include dark mode support', () => {
      const html = generateAlertHtml(sampleAlertData);

      expect(html).toContain('@media (prefers-color-scheme: dark)');
      expect(html).toContain('.email-body');
      expect(html).toContain('.email-container');
    });
  });

  describe('Content Safety', () => {
    it('should escape XSS attempts in all fields', () => {
      const xssData: AlertTemplateData = {
        ...sampleAlertData,
        title: '<script>alert("xss")</script>Malicious Title',
        message: '<img onerror="alert(1)" src="x">Bad content',
        walletAddress: '<script>steal()</script>',
        marketTitle: '"><script>hack()</script>',
        recipientName: '<img src=x onerror=alert(1)>',
        metadata: {
          'Bad<script>Key': 'value',
          key: '<script>Bad</script>Value',
        },
      };

      const result = renderAlertEmail(xssData);

      // Script tags should be escaped as HTML entities
      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).toContain('&lt;img');

      // Raw script tags should not exist (check they're properly escaped)
      // The actual content inside attribute values will be escaped
      expect(result.html.includes('<script>alert')).toBe(false);
    });

    it('should handle unicode characters correctly', () => {
      const unicodeData: AlertTemplateData = {
        ...sampleAlertData,
        title: 'Alert 🚀 with émojis and ñ characters',
        message: '日本語メッセージ with 中文 and العربية',
        recipientName: 'José García 王',
      };

      const result = renderAlertEmail(unicodeData);

      expect(result.html).toContain('🚀');
      expect(result.html).toContain('émojis');
      expect(result.html).toContain('日本語');
      expect(result.html).toContain('José García');
    });

    it('should handle very long content gracefully', () => {
      const longMessage = 'A'.repeat(10000);
      const longData: AlertTemplateData = {
        ...sampleAlertData,
        message: longMessage,
      };

      const result = renderAlertEmail(longData);

      // Should still render
      expect(result.html.length).toBeGreaterThan(10000);
      expect(result.text.length).toBeGreaterThan(10000);

      // Should contain the content
      expect(result.html).toContain(longMessage);
    });
  });

  describe('Email Client Integration', () => {
    it('should work with EmailClient in dev mode', async () => {
      const client = createEmailClient({
        apiKey: 'test_key',
        devMode: true,
      });

      // Capture console log
      const consoleSpy = vi.spyOn(console, 'log');

      const message = createAlertEmailMessage(sampleAlertData, 'test@example.com');
      const result = await client.send({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      // Should succeed in dev mode
      expect(result.status).toBe('sent');
      expect(result.recipients).toContain('test@example.com');

      // Dev mode should log the email
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL DEV MODE]'),
        expect.objectContaining({
          to: ['test@example.com'],
          subject: message.subject,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should create batch of emails for multiple recipients', () => {
      const recipients = [
        'analyst1@firm.com',
        'analyst2@firm.com',
        'manager@firm.com',
      ];

      const messages = recipients.map(email =>
        createAlertEmailMessage(sampleAlertData, email)
      );

      expect(messages).toHaveLength(3);
      messages.forEach((msg, i) => {
        expect(msg.to).toBe(recipients[i]);
        expect(msg.subject).toBe(messages[0]!.subject);
      });
    });
  });

  describe('Customization Options', () => {
    it('should apply custom styles', () => {
      const customCss = '.custom-header { color: #ff0000; }';
      const html = generateAlertHtml(sampleAlertData, { customStyles: customCss });

      expect(html).toContain(customCss);
    });

    it('should hide footer when disabled', () => {
      const html = generateAlertHtml(sampleAlertData, { showFooter: false });

      expect(html).not.toContain('Unsubscribe from alerts');
      expect(html).not.toContain('receiving this email');
    });

    it('should hide branding when disabled', () => {
      const html = generateAlertHtml(sampleAlertData, { showBranding: false });

      expect(html).not.toContain('Powered by Polymarket Tracker');
    });

    it('should use different timezone', () => {
      const utcHtml = generateAlertHtml(sampleAlertData, { timezone: 'UTC' });
      const estHtml = generateAlertHtml(sampleAlertData, { timezone: 'America/New_York' });

      // Times should be different
      expect(utcHtml).not.toEqual(estHtml);
    });
  });

  describe('Data Validation', () => {
    it('should validate complete data', () => {
      expect(validateAlertTemplateData(sampleAlertData)).toBe(true);
    });

    it('should reject invalid data', () => {
      expect(validateAlertTemplateData(null)).toBe(false);
      expect(validateAlertTemplateData(undefined)).toBe(false);
      expect(validateAlertTemplateData({})).toBe(false);
      expect(validateAlertTemplateData({ alertId: 'test' })).toBe(false);
    });

    it('should validate all required fields', () => {
      const requiredFields = ['alertId', 'alertType', 'severity', 'title', 'message', 'timestamp'];

      requiredFields.forEach(field => {
        const invalidData = { ...sampleAlertData };
        delete (invalidData as Record<string, unknown>)[field];
        expect(validateAlertTemplateData(invalidData)).toBe(false);
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should render insider trading alert', () => {
      const insiderAlert: AlertTemplateData = {
        alertId: 'insider_001',
        alertType: 'insider_activity',
        severity: 'critical',
        title: 'Potential Insider Trading Detected',
        message:
          'A wallet with no prior trading history made a $150,000 trade just 2 hours before the market resolution. The position was fully correct, suggesting possible non-public information.',
        timestamp: new Date(),
        walletAddress: '0xabcd1234efgh5678ijkl9012mnop3456qrst7890',
        marketId: 'market_sec_decision',
        marketTitle: 'Will SEC approve Bitcoin ETF by Q1 2026?',
        tradeSize: 150000,
        suspicionScore: 95,
        metadata: {
          'Time Before Resolution': '2 hours',
          'Wallet Age': '3 days',
          'Previous Trades': 0,
          'Position': 'YES @ $0.35',
          'Final Resolution': 'YES @ $1.00',
        },
      };

      const result = renderAlertEmail(insiderAlert);

      expect(result.html).toContain('Insider Activity');
      expect(result.html).toContain('95/100');
      expect(result.html).toContain('3 days');
      expect(result.subject).toContain('🚨');
    });

    it('should render coordinated activity alert', () => {
      const coordinatedAlert: AlertTemplateData = {
        alertId: 'coord_001',
        alertType: 'coordinated_activity',
        severity: 'high',
        title: 'Coordinated Trading Cluster Detected',
        message:
          '15 wallets executed trades within a 5-minute window, all betting the same direction on a low-volume market. Total coordinated volume: $450,000.',
        timestamp: new Date(),
        marketId: 'market_obscure_001',
        marketTitle: 'Will obscure bill XYZ pass the Senate?',
        tradeSize: 450000,
        suspicionScore: 82,
        metadata: {
          'Wallets Involved': 15,
          'Time Window': '5 minutes',
          'Direction': 'All YES',
          'Cluster Score': 0.94,
        },
      };

      const result = renderAlertEmail(coordinatedAlert);

      expect(result.html).toContain('Coordinated Activity');
      expect(result.html).toContain('$450,000');
      expect(result.html).toContain('15 wallets');
    });

    it('should render market resolved notification', () => {
      const resolvedAlert: AlertTemplateData = {
        alertId: 'resolved_001',
        alertType: 'market_resolved',
        severity: 'info',
        title: 'Market Has Been Resolved',
        message:
          'The market "Will Bitcoin reach $100K in 2025?" has been resolved to YES. Final settlement price: $1.00.',
        timestamp: new Date(),
        marketId: 'market_btc_100k',
        marketTitle: 'Will Bitcoin reach $100K in 2025?',
        metadata: {
          Resolution: 'YES',
          'Settlement Price': '$1.00',
          'Total Volume': '$12.5M',
          Participants: 8542,
        },
      };

      const result = renderAlertEmail(resolvedAlert);

      expect(result.html).toContain('Market Resolved');
      expect(result.html).toContain('[INFO]');
      expect(result.html).not.toContain('🚨'); // Not critical
    });
  });

  describe('Performance', () => {
    it('should render quickly for large batches', () => {
      const startTime = Date.now();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        renderAlertEmail({
          ...sampleAlertData,
          alertId: `perf_${i}`,
        });
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      // Average render time should be under 10ms
      expect(avgTime).toBeLessThan(10);
    });

    it('should generate consistent output', () => {
      const result1 = renderAlertEmail(sampleAlertData);
      const result2 = renderAlertEmail(sampleAlertData);

      expect(result1.subject).toBe(result2.subject);
      expect(result1.html).toBe(result2.html);
      expect(result1.text).toBe(result2.text);
    });
  });

  describe('Plain Text Quality', () => {
    it('should be readable without HTML', () => {
      const text = generateAlertPlainText(sampleAlertData);

      // Should have clear section separators
      expect(text).toContain('=');
      expect(text).toContain('-');

      // Should have all important information
      expect(text).toContain('CRITICAL');
      expect(text).toContain('Massive Whale Trade Detected');
      expect(text).toContain('$2,500,000');
      expect(text).toContain('View Alert:');
      expect(text).toContain('Alert ID:');
    });

    it('should not contain HTML tags', () => {
      const text = generateAlertPlainText(sampleAlertData);

      expect(text).not.toContain('<html');
      expect(text).not.toContain('<body');
      expect(text).not.toContain('<table');
      expect(text).not.toContain('<div');
      expect(text).not.toContain('<span');
    });

    it('should have proper line breaks', () => {
      const text = generateAlertPlainText(sampleAlertData);
      const lines = text.split('\n');

      // Should have multiple lines
      expect(lines.length).toBeGreaterThan(10);

      // Most lines shouldn't be too long (for email clients)
      // Allow some longer lines for URLs and message content
      const shortLines = lines.filter(line =>
        !line.includes('http') && line.length < 500
      );
      expect(shortLines.length).toBeGreaterThan(5);
    });
  });
});
