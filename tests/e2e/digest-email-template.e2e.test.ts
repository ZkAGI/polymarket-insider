/**
 * E2E tests for daily digest email template
 * Tests the end-to-end rendering, scheduling, and email compatibility of digest templates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Types
  DailyDigestData,
  // Template functions
  renderDigestEmail,
  generateDigestHtml,
  generateDigestPlainText,
  createDigestEmailMessage,
  validateDigestData,
  createSampleDigestData,
  // Scheduler functions
  DigestScheduler,
  createDigestScheduler,
  validateScheduleConfig,
  createScheduleConfig,
  calculateNextRunTime,
  isScheduledTimeDue,
  getDigestDateFromRunTime,
  isValidTimezone,
  SUPPORTED_TIMEZONES,
} from '../../src/notifications/email/templates';
import { createEmailClient } from '../../src/notifications/email';

describe('Daily Digest Email Template E2E', () => {
  let sampleDigestData: DailyDigestData;

  beforeEach(() => {
    sampleDigestData = createSampleDigestData({
      digestId: 'e2e_digest_001',
      recipientName: 'Trading Analyst',
      dashboardUrl: 'https://polymarket-tracker.example.com/dashboard',
      baseUrl: 'https://polymarket-tracker.example.com',
      unsubscribeUrl: 'https://polymarket-tracker.example.com/unsubscribe?token=abc123',
    });
  });

  describe('Full Email Rendering Pipeline', () => {
    it('should render complete digest email with all components', () => {
      const result = renderDigestEmail(sampleDigestData);

      // Verify all three parts are generated
      expect(result.subject).toBeDefined();
      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();

      // Subject should contain date
      expect(result.subject).toContain('Daily Digest');

      // HTML should contain all major sections
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('Daily Digest');
      expect(result.html).toContain('Alert Summary');
      expect(result.html).toContain('Trading Analyst');

      // Plain text should be readable
      expect(result.text).toContain('DAILY DIGEST');
      expect(result.text).toContain('ALERT SUMMARY');
    });

    it('should include critical alert count in subject when present', () => {
      sampleDigestData.alertCounts.critical = 5;
      const result = renderDigestEmail(sampleDigestData);

      expect(result.subject).toContain('5 Critical Alerts');
    });

    it('should generate valid email message object for sending', () => {
      const message = createDigestEmailMessage(
        sampleDigestData,
        'analyst@trading-firm.com',
        { showFooter: true, showBranding: true }
      );

      expect(message.to).toBe('analyst@trading-firm.com');
      expect(message.subject.length).toBeGreaterThan(0);
      expect(message.html.length).toBeGreaterThan(1000);
      expect(message.text.length).toBeGreaterThan(100);
    });
  });

  describe('All Sections Rendering', () => {
    it('should render alert summary with all severity levels', () => {
      const result = renderDigestEmail(sampleDigestData);

      // Should show severity counts
      expect(result.html).toContain('CRITICAL');
      expect(result.html).toContain('HIGH');
      expect(result.html).toContain('MEDIUM');
    });

    it('should render recent alerts section', () => {
      const result = renderDigestEmail(sampleDigestData);

      expect(result.html).toContain('Recent Alerts');
      // Should contain first alert info
      if (sampleDigestData.recentAlerts.length > 0) {
        const firstAlert = sampleDigestData.recentAlerts[0]!;
        expect(result.html).toContain(firstAlert.title);
      }
    });

    it('should render suspicious wallets section', () => {
      const result = renderDigestEmail(sampleDigestData);

      expect(result.html).toContain('Top Suspicious Wallets');
      // Should show wallet scores
      sampleDigestData.topSuspiciousWallets.forEach(wallet => {
        expect(result.html).toContain(String(wallet.score));
      });
    });

    it('should render hot markets section', () => {
      const result = renderDigestEmail(sampleDigestData);

      expect(result.html).toContain('Hot Markets');
      // Should show market info
      if (sampleDigestData.hotMarkets.length > 0) {
        const firstMarket = sampleDigestData.hotMarkets[0]!;
        expect(result.html).toContain(firstMarket.title.substring(0, 20));
      }
    });

    it('should render trading statistics', () => {
      const result = renderDigestEmail(sampleDigestData, { showTradingStats: true });

      expect(result.html).toContain('Trading Activity');
      expect(result.html).toContain('Whale Trades');
      expect(result.html).toContain('Total Volume');
    });

    it('should render comparison section when data present', () => {
      const result = renderDigestEmail(sampleDigestData, { showComparison: true });

      expect(result.html).toContain('vs Previous Day');
    });

    it('should render highlights section when present', () => {
      const result = renderDigestEmail(sampleDigestData, { showHighlights: true });

      if (sampleDigestData.highlights && sampleDigestData.highlights.length > 0) {
        expect(result.html).toContain('Key Highlights');
      }
    });
  });

  describe('Email Client Compatibility', () => {
    it('should use email-safe HTML structure', () => {
      const html = generateDigestHtml(sampleDigestData);

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
      const html = generateDigestHtml(sampleDigestData);

      // All colors should be hex
      const colorPattern = /#[0-9a-fA-F]{6}/g;
      const hexColors = html.match(colorPattern);
      expect(hexColors).not.toBeNull();
      expect(hexColors!.length).toBeGreaterThan(5);
    });

    it('should provide fallback fonts', () => {
      const html = generateDigestHtml(sampleDigestData);

      // Font stack with web-safe fallbacks
      expect(html).toMatch(/font-family:[^;]*-apple-system/);
      expect(html).toMatch(/font-family:[^;]*Arial/);
      expect(html).toMatch(/font-family:[^;]*sans-serif/);
    });

    it('should include dark mode support', () => {
      const html = generateDigestHtml(sampleDigestData);

      expect(html).toContain('@media (prefers-color-scheme: dark)');
      expect(html).toContain('.email-body');
      expect(html).toContain('.email-container');
    });
  });

  describe('Content Safety', () => {
    it('should escape XSS attempts in all fields', () => {
      const xssData: DailyDigestData = {
        ...sampleDigestData,
        recipientName: '<script>alert("xss")</script>',
        recentAlerts: [{
          id: 'xss-alert',
          type: 'whale_trade',
          severity: 'high',
          title: '<img onerror="alert(1)" src="x">Bad Title',
          timestamp: new Date(),
        }],
        topSuspiciousWallets: [{
          address: '<script>hack()</script>',
          score: 90,
          alertCount: 5,
        }],
        hotMarkets: [{
          id: 'xss-market',
          title: '"><script>steal()</script>',
          alertCount: 3,
        }],
      };

      const result = renderDigestEmail(xssData);

      // Script tags should be escaped as HTML entities
      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).toContain('&lt;img');

      // Raw script tags should not exist
      expect(result.html.includes('<script>alert')).toBe(false);
    });

    it('should handle unicode characters correctly', () => {
      const unicodeData: DailyDigestData = {
        ...sampleDigestData,
        recipientName: 'José García 王 🚀',
        hotMarkets: [{
          id: 'unicode-market',
          title: '日本語マーケット with 中文 and العربية',
          alertCount: 3,
        }],
      };

      const result = renderDigestEmail(unicodeData);

      expect(result.html).toContain('José García');
      expect(result.html).toContain('日本語');
      expect(result.html).toContain('🚀');
    });

    it('should handle very large data sets gracefully', () => {
      const largeData: DailyDigestData = {
        ...sampleDigestData,
        recentAlerts: Array(100).fill(null).map((_, i) => ({
          id: `alert-${i}`,
          type: 'whale_trade' as const,
          severity: 'medium' as const,
          title: `Large Alert ${i} with longer description text`,
          timestamp: new Date(),
        })),
        topSuspiciousWallets: Array(50).fill(null).map((_, i) => ({
          address: `0x${'a'.repeat(40)}${i}`.slice(0, 42),
          score: 50 + (i % 50),
          alertCount: i,
        })),
        hotMarkets: Array(30).fill(null).map((_, i) => ({
          id: `market-${i}`,
          title: `Hot Market ${i} with description`,
          alertCount: i * 2,
        })),
      };

      const result = renderDigestEmail(largeData, {
        maxAlerts: 10,
        maxWallets: 5,
        maxMarkets: 5,
      });

      // Should still render
      expect(result.html.length).toBeGreaterThan(1000);
      expect(result.text.length).toBeGreaterThan(100);

      // Should indicate truncation
      expect(result.html).toContain('Showing 10 of 100');
    });
  });

  describe('Timezone Support', () => {
    it('should render correctly for all supported timezones', () => {
      SUPPORTED_TIMEZONES.forEach(timezone => {
        const result = renderDigestEmail(sampleDigestData, { timezone });

        expect(result.html.length).toBeGreaterThan(1000);
        expect(result.text.length).toBeGreaterThan(100);
      });
    });

    it('should show different times for different timezones', () => {
      const utcResult = renderDigestEmail(sampleDigestData, { timezone: 'UTC' });
      const tokyoResult = renderDigestEmail(sampleDigestData, { timezone: 'Asia/Tokyo' });

      // The formatted dates should be different
      expect(utcResult.html).not.toEqual(tokyoResult.html);
    });

    it('should handle daylight saving time correctly', () => {
      // Use a date around DST transition
      const dstData: DailyDigestData = {
        ...sampleDigestData,
        digestDate: new Date('2026-03-08T07:00:00Z'), // Around US DST change
        generatedAt: new Date('2026-03-09T08:00:00Z'),
      };

      const result = renderDigestEmail(dstData, { timezone: 'America/New_York' });

      expect(result.html.length).toBeGreaterThan(1000);
    });
  });

  describe('Email Client Integration', () => {
    it('should work with EmailClient in dev mode', async () => {
      const client = createEmailClient({
        apiKey: 'test_key',
        devMode: true,
      });

      const consoleSpy = vi.spyOn(console, 'log');

      const message = createDigestEmailMessage(sampleDigestData, 'test@example.com');
      const result = await client.send({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      expect(result.status).toBe('sent');
      expect(result.recipients).toContain('test@example.com');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL DEV MODE]'),
        expect.objectContaining({
          to: ['test@example.com'],
          subject: message.subject,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should create batch of digests for multiple recipients', () => {
      const recipients = [
        'analyst1@firm.com',
        'analyst2@firm.com',
        'manager@firm.com',
      ];

      const messages = recipients.map(email =>
        createDigestEmailMessage(sampleDigestData, email, { timezone: 'UTC' })
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
      const html = generateDigestHtml(sampleDigestData, { customStyles: customCss });

      expect(html).toContain(customCss);
    });

    it('should hide footer when disabled', () => {
      const html = generateDigestHtml(sampleDigestData, { showFooter: false });

      expect(html).not.toContain('Unsubscribe from digests');
      expect(html).not.toContain('receiving this daily digest');
    });

    it('should hide branding when disabled', () => {
      const html = generateDigestHtml(sampleDigestData, { showBranding: false });

      expect(html).not.toContain('Powered by Polymarket Tracker');
    });

    it('should hide trading stats when disabled', () => {
      const html = generateDigestHtml(sampleDigestData, { showTradingStats: false });

      expect(html).not.toContain('Trading Activity');
    });

    it('should hide comparison when disabled', () => {
      const html = generateDigestHtml(sampleDigestData, { showComparison: false });

      expect(html).not.toContain('vs Previous Day');
    });

    it('should respect maxAlerts option', () => {
      const manyAlerts = Array(20).fill(null).map((_, i) => ({
        id: `alert-${i}`,
        type: 'whale_trade' as const,
        severity: 'medium' as const,
        title: `Alert ${i}`,
        timestamp: new Date(),
      }));

      const data: DailyDigestData = { ...sampleDigestData, recentAlerts: manyAlerts };
      const html = generateDigestHtml(data, { maxAlerts: 5 });

      expect(html).toContain('Showing 5 of 20');
    });
  });

  describe('Plain Text Quality', () => {
    it('should be readable without HTML', () => {
      const text = generateDigestPlainText(sampleDigestData);

      // Should have clear section separators
      expect(text).toContain('=');
      expect(text).toContain('-');

      // Should have all important information
      expect(text).toContain('DAILY DIGEST');
      expect(text).toContain('ALERT SUMMARY');
      expect(text).toContain('Total Alerts:');
    });

    it('should not contain HTML tags', () => {
      const text = generateDigestPlainText(sampleDigestData);

      expect(text).not.toContain('<html');
      expect(text).not.toContain('<body');
      expect(text).not.toContain('<table');
      expect(text).not.toContain('<div');
    });

    it('should have proper line breaks', () => {
      const text = generateDigestPlainText(sampleDigestData);
      const lines = text.split('\n');

      expect(lines.length).toBeGreaterThan(20);
    });

    it('should include all major sections', () => {
      const text = generateDigestPlainText(sampleDigestData, { showTradingStats: true });

      expect(text).toContain('ALERT SUMMARY');
      expect(text).toContain('TRADING ACTIVITY');
      expect(text).toContain('TOP SUSPICIOUS WALLETS');
      expect(text).toContain('HOT MARKETS');
    });
  });

  describe('Data Validation', () => {
    it('should validate complete data', () => {
      expect(validateDigestData(sampleDigestData)).toBe(true);
    });

    it('should reject invalid data', () => {
      expect(validateDigestData(null)).toBe(false);
      expect(validateDigestData(undefined)).toBe(false);
      expect(validateDigestData({})).toBe(false);
    });

    it('should validate all required fields', () => {
      const requiredFields = [
        'digestId', 'digestDate', 'generatedAt', 'alertCounts',
        'recentAlerts', 'topSuspiciousWallets', 'hotMarkets', 'tradingStats'
      ];

      requiredFields.forEach(field => {
        const invalidData = { ...sampleDigestData };
        delete (invalidData as Record<string, unknown>)[field];
        expect(validateDigestData(invalidData)).toBe(false);
      });
    });
  });

  describe('Performance', () => {
    it('should render quickly for normal data', () => {
      const startTime = Date.now();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        renderDigestEmail({
          ...sampleDigestData,
          digestId: `perf_${i}`,
        });
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      // Average render time should be under 20ms
      expect(avgTime).toBeLessThan(20);
    });

    it('should generate consistent output', () => {
      const result1 = renderDigestEmail(sampleDigestData);
      const result2 = renderDigestEmail(sampleDigestData);

      expect(result1.subject).toBe(result2.subject);
      expect(result1.html).toBe(result2.html);
      expect(result1.text).toBe(result2.text);
    });
  });
});

describe('Digest Scheduler E2E', () => {
  let scheduler: DigestScheduler;

  beforeEach(() => {
    scheduler = createDigestScheduler({
      checkInterval: 100, // Fast check for testing
      gracePeriod: 5000,
    });
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('Schedule Configuration', () => {
    it('should create valid schedule config', () => {
      const config = createScheduleConfig('test@example.com', {
        sendHour: 9,
        sendMinute: 30,
        timezone: 'America/New_York',
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays only
      });

      expect(validateScheduleConfig(config)).toBe(true);
      expect(config.recipientEmail).toBe('test@example.com');
      expect(config.sendHour).toBe(9);
      expect(config.timezone).toBe('America/New_York');
    });

    it('should validate timezone in config', () => {
      const validConfig = createScheduleConfig('test@example.com', { timezone: 'UTC' });
      const invalidConfig = { ...validConfig, timezone: 'Invalid/Timezone' };

      expect(validateScheduleConfig(validConfig)).toBe(true);
      expect(validateScheduleConfig(invalidConfig)).toBe(false);
    });

    it('should validate hours and minutes', () => {
      const validConfig = createScheduleConfig('test@example.com');

      expect(validateScheduleConfig({ ...validConfig, sendHour: 0 })).toBe(true);
      expect(validateScheduleConfig({ ...validConfig, sendHour: 23 })).toBe(true);
      expect(validateScheduleConfig({ ...validConfig, sendHour: 24 })).toBe(false);
      expect(validateScheduleConfig({ ...validConfig, sendHour: -1 })).toBe(false);

      expect(validateScheduleConfig({ ...validConfig, sendMinute: 0 })).toBe(true);
      expect(validateScheduleConfig({ ...validConfig, sendMinute: 59 })).toBe(true);
      expect(validateScheduleConfig({ ...validConfig, sendMinute: 60 })).toBe(false);
    });

    it('should validate days of week', () => {
      const validConfig = createScheduleConfig('test@example.com');

      expect(validateScheduleConfig({ ...validConfig, daysOfWeek: [0, 6] })).toBe(true);
      expect(validateScheduleConfig({ ...validConfig, daysOfWeek: [7] })).toBe(false);
      expect(validateScheduleConfig({ ...validConfig, daysOfWeek: [-1] })).toBe(false);
    });
  });

  describe('Scheduling Logic', () => {
    it('should calculate next run time correctly', () => {
      const config = createScheduleConfig('test@example.com', {
        sendHour: 8,
        sendMinute: 0,
        timezone: 'UTC',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      });

      const nextRun = calculateNextRunTime(config);

      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it('should skip disabled days', () => {
      // Start from a Tuesday
      const tuesday = new Date('2026-01-13T12:00:00Z');
      const config = createScheduleConfig('test@example.com', {
        sendHour: 8,
        sendMinute: 0,
        timezone: 'UTC',
        daysOfWeek: [4], // Only Thursday
      });

      const nextRun = calculateNextRunTime(config, tuesday);

      // Should be Thursday (day 4)
      expect(nextRun.getTime()).toBeGreaterThan(tuesday.getTime());
    });

    it('should handle time already passed today', () => {
      const now = new Date();
      const config = createScheduleConfig('test@example.com', {
        sendHour: Math.max(0, now.getUTCHours() - 2), // 2 hours ago
        sendMinute: 0,
        timezone: 'UTC',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      });

      const nextRun = calculateNextRunTime(config);

      // Should be tomorrow at the specified time
      expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should respect timezone for scheduling', () => {
      const config1 = createScheduleConfig('test@example.com', {
        sendHour: 8,
        sendMinute: 0,
        timezone: 'UTC',
      });
      const config2 = createScheduleConfig('test@example.com', {
        sendHour: 8,
        sendMinute: 0,
        timezone: 'America/New_York',
      });

      const nextRun1 = calculateNextRunTime(config1);
      const nextRun2 = calculateNextRunTime(config2);

      // UTC and EST runs should be different
      expect(nextRun1.getTime()).not.toBe(nextRun2.getTime());
    });
  });

  describe('Due Time Detection', () => {
    it('should detect when time is due', () => {
      const pastTime = new Date(Date.now() - 1000); // 1 second ago
      const futureTime = new Date(Date.now() + 60000); // 1 minute future

      expect(isScheduledTimeDue(pastTime, 5000)).toBe(true);
      expect(isScheduledTimeDue(futureTime, 5000)).toBe(false);
    });

    it('should respect grace period', () => {
      const pastTime = new Date(Date.now() - 10000); // 10 seconds ago

      expect(isScheduledTimeDue(pastTime, 5000)).toBe(false); // Outside 5s grace
      expect(isScheduledTimeDue(pastTime, 15000)).toBe(true); // Within 15s grace
    });
  });

  describe('Digest Date Calculation', () => {
    it('should return previous day for digest date', () => {
      const runTime = new Date('2026-01-13T08:00:00Z');
      const digestDate = getDigestDateFromRunTime(runTime, 'UTC');

      expect(digestDate.getUTCDate()).toBe(12); // Previous day
      expect(digestDate.getUTCMonth()).toBe(0); // January
      expect(digestDate.getUTCFullYear()).toBe(2026);
    });

    it('should return start of day', () => {
      const runTime = new Date('2026-01-13T15:30:45Z');
      const digestDate = getDigestDateFromRunTime(runTime, 'UTC');

      expect(digestDate.getUTCHours()).toBe(0);
      expect(digestDate.getUTCMinutes()).toBe(0);
      expect(digestDate.getUTCSeconds()).toBe(0);
    });
  });

  describe('Scheduler Operations', () => {
    it('should schedule and retrieve jobs', () => {
      const config = createScheduleConfig('test@example.com', {
        sendHour: 8,
        timezone: 'UTC',
      });

      const job = scheduler.scheduleDigest(config);

      expect(job.id).toBeDefined();
      expect(job.nextRunTime).toBeInstanceOf(Date);
      expect(job.isActive).toBe(true);

      const retrieved = scheduler.getJob('test@example.com');
      expect(retrieved).toBeDefined();
      expect(retrieved?.config.recipientEmail).toBe('test@example.com');
    });

    it('should list all jobs', () => {
      scheduler.scheduleDigest(createScheduleConfig('user1@example.com'));
      scheduler.scheduleDigest(createScheduleConfig('user2@example.com'));
      scheduler.scheduleDigest(createScheduleConfig('user3@example.com'));

      const jobs = scheduler.getAllJobs();
      expect(jobs.length).toBe(3);
    });

    it('should remove jobs', () => {
      scheduler.scheduleDigest(createScheduleConfig('test@example.com'));

      expect(scheduler.getJob('test@example.com')).toBeDefined();

      const removed = scheduler.removeJob('test@example.com');
      expect(removed).toBe(true);
      expect(scheduler.getJob('test@example.com')).toBeUndefined();
    });

    it('should update existing job on reschedule', () => {
      scheduler.scheduleDigest(createScheduleConfig('test@example.com', { sendHour: 8 }));
      scheduler.scheduleDigest(createScheduleConfig('test@example.com', { sendHour: 10 }));

      const jobs = scheduler.getAllJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0]!.config.sendHour).toBe(10);
    });

    it('should start and stop scheduler', () => {
      expect(scheduler.getStatus().isRunning).toBe(false);

      scheduler.start();
      expect(scheduler.getStatus().isRunning).toBe(true);

      scheduler.stop();
      expect(scheduler.getStatus().isRunning).toBe(false);
    });

    it('should emit events on job operations', () => {
      const events: string[] = [];

      scheduler.on('job:scheduled', () => events.push('scheduled'));
      scheduler.on('job:removed', () => events.push('removed'));

      scheduler.scheduleDigest(createScheduleConfig('test@example.com'));
      scheduler.removeJob('test@example.com');

      expect(events).toContain('scheduled');
      expect(events).toContain('removed');
    });

    it('should provide scheduler status', () => {
      scheduler.scheduleDigest(createScheduleConfig('test@example.com'));
      scheduler.start();

      const status = scheduler.getStatus();

      expect(status).toHaveProperty('isRunning', true);
      expect(status).toHaveProperty('totalJobs', 1);
      expect(status).toHaveProperty('activeJobs', 0);
      expect(status).toHaveProperty('nextDueJob');
    });
  });

  describe('Timezone Support', () => {
    it('should validate all supported timezones', () => {
      SUPPORTED_TIMEZONES.forEach(tz => {
        expect(isValidTimezone(tz)).toBe(true);
      });
    });

    it('should reject invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone('Not/A/Real/Timezone')).toBe(false);
    });

    it('should schedule digests in different timezones', () => {
      const utcConfig = createScheduleConfig('utc@example.com', { timezone: 'UTC' });
      const nyConfig = createScheduleConfig('ny@example.com', { timezone: 'America/New_York' });
      const tokyoConfig = createScheduleConfig('tokyo@example.com', { timezone: 'Asia/Tokyo' });

      const utcJob = scheduler.scheduleDigest(utcConfig);
      const nyJob = scheduler.scheduleDigest(nyConfig);
      const tokyoJob = scheduler.scheduleDigest(tokyoConfig);

      // All jobs should be scheduled
      expect(utcJob.nextRunTime).toBeInstanceOf(Date);
      expect(nyJob.nextRunTime).toBeInstanceOf(Date);
      expect(tokyoJob.nextRunTime).toBeInstanceOf(Date);

      // Different timezones should have different next run times
      const times = [utcJob.nextRunTime, nyJob.nextRunTime, tokyoJob.nextRunTime];
      const uniqueTimes = new Set(times.map(t => t.getTime()));
      expect(uniqueTimes.size).toBeGreaterThan(1);
    });
  });

  describe('Integration with Email Rendering', () => {
    it('should generate complete digest for scheduled delivery', async () => {
      const config = createScheduleConfig('recipient@example.com', {
        recipientName: 'Test User',
        timezone: 'America/New_York',
      });

      // Create digest data
      const digestDate = getDigestDateFromRunTime(new Date(), config.timezone);
      const digestData = createSampleDigestData({
        recipientName: config.recipientName,
        timezone: config.timezone,
        digestDate,
      });

      // Render email
      const message = createDigestEmailMessage(
        digestData,
        config.recipientEmail,
        { timezone: config.timezone }
      );

      expect(message.to).toBe('recipient@example.com');
      expect(message.subject).toContain('Daily Digest');
      expect(message.html).toContain('Test User');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing data provider gracefully', async () => {
      const config = createScheduleConfig('test@example.com');
      scheduler.scheduleDigest(config);

      // Trigger without data provider - should update job with error status (not throw)
      await scheduler.triggerDigest('test@example.com');

      const job = scheduler.getJob('test@example.com');
      expect(job).toBeDefined();
      expect(job!.lastRunStatus).toBe('failed');
      expect(job!.lastError).toContain('not configured');
    });

    it('should handle invalid job removal gracefully', () => {
      const removed = scheduler.removeJob('nonexistent@example.com');
      expect(removed).toBe(false);
    });
  });
});
