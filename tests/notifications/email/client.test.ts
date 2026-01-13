/**
 * Unit tests for email client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EmailClient,
  EmailClientError,
  createEmailClient,
  getEmailClient,
  resetEmailClient,
} from '../../../src/notifications/email/client';
import {
  EmailStatus,
  EmailPriority,
  EmailMessage,
  EmailClientConfig,
} from '../../../src/notifications/email/types';

// Mock Resend
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock_email_id' }, error: null }),
    };
  },
}));

describe('EmailClient', () => {
  let client: EmailClient;
  const defaultConfig: EmailClientConfig = {
    apiKey: 'test_api_key',
    defaultFrom: 'test@example.com',
    defaultFromName: 'Test Sender',
    devMode: true, // Use dev mode for most tests
  };

  beforeEach(() => {
    client = createEmailClient(defaultConfig);
  });

  afterEach(() => {
    resetEmailClient();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default configuration', () => {
      const minimalConfig: EmailClientConfig = { apiKey: 'key' };
      const minimalClient = createEmailClient(minimalConfig);
      const config = minimalClient.getConfig();

      expect(config.apiKey).toBe('key');
      expect(config.defaultFrom).toBeDefined();
      expect(config.rateLimit).toBeGreaterThan(0);
      expect(config.maxRetries).toBeGreaterThan(0);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: EmailClientConfig = {
        apiKey: 'custom_key',
        defaultFrom: 'custom@example.com',
        rateLimit: 5,
        maxRetries: 5,
      };
      const customClient = createEmailClient(customConfig);
      const config = customClient.getConfig();

      expect(config.apiKey).toBe('custom_key');
      expect(config.defaultFrom).toBe('custom@example.com');
      expect(config.rateLimit).toBe(5);
      expect(config.maxRetries).toBe(5);
    });
  });

  describe('getConfig', () => {
    it('should return configuration (read-only)', () => {
      const config = client.getConfig();
      expect(config.apiKey).toBe('test_api_key');
      expect(config.defaultFrom).toBe('test@example.com');
      expect(config.defaultFromName).toBe('Test Sender');
    });
  });

  describe('isDevMode', () => {
    it('should return true when in dev mode', () => {
      expect(client.isDevMode()).toBe(true);
    });

    it('should return false when not in dev mode', () => {
      const prodClient = createEmailClient({ ...defaultConfig, devMode: false });
      expect(prodClient.isDevMode()).toBe(false);
    });
  });

  describe('getStats and resetStats', () => {
    it('should return initial stats', () => {
      const stats = client.getStats();
      expect(stats.sent).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.total).toBe(0);
    });

    it('should track sent emails', async () => {
      await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      const stats = client.getStats();
      expect(stats.sent).toBe(1);
      expect(stats.total).toBe(1);
    });

    it('should reset stats', async () => {
      await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      client.resetStats();
      const stats = client.getStats();
      expect(stats.sent).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe('send', () => {
    it('should send email successfully in dev mode', async () => {
      const result = await client.send({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message body',
      });

      expect(result.status).toBe(EmailStatus.SENT);
      expect(result.id).toMatch(/^dev_/);
      expect(result.recipients).toContain('recipient@example.com');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should send email with multiple recipients', async () => {
      const result = await client.send({
        to: ['a@example.com', 'b@example.com'],
        subject: 'Test',
        text: 'Test message',
      });

      expect(result.status).toBe(EmailStatus.SENT);
      expect(result.recipients).toHaveLength(2);
      expect(result.recipients).toContain('a@example.com');
      expect(result.recipients).toContain('b@example.com');
    });

    it('should send email with HTML content', async () => {
      const result = await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<h1>Test</h1><p>HTML content</p>',
      });

      expect(result.status).toBe(EmailStatus.SENT);
    });

    it('should send email with both HTML and text', async () => {
      const result = await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>HTML content</p>',
        text: 'Plain text content',
      });

      expect(result.status).toBe(EmailStatus.SENT);
    });

    it('should send email with custom from address', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await client.send({
        to: 'recipient@example.com',
        from: 'custom@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL DEV MODE]'),
        expect.objectContaining({
          from: 'custom@example.com',
        })
      );
    });

    it('should send email with recipient object', async () => {
      const result = await client.send({
        to: { email: 'recipient@example.com', name: 'Test Recipient' },
        subject: 'Test',
        text: 'Test message',
      });

      expect(result.status).toBe(EmailStatus.SENT);
      expect(result.recipients).toContain('recipient@example.com');
    });

    it('should validate recipient is required', async () => {
      await expect(
        client.send({
          to: '' as string,
          subject: 'Test',
          text: 'Test message',
        })
      ).rejects.toThrow(EmailClientError);
    });

    it('should validate email format', async () => {
      await expect(
        client.send({
          to: 'invalid-email',
          subject: 'Test',
          text: 'Test message',
        })
      ).rejects.toThrow('Invalid email address');
    });

    it('should validate subject is required', async () => {
      await expect(
        client.send({
          to: 'recipient@example.com',
          subject: '',
          text: 'Test message',
        })
      ).rejects.toThrow('Subject is required');
    });

    it('should validate content is required', async () => {
      await expect(
        client.send({
          to: 'recipient@example.com',
          subject: 'Test',
        } as EmailMessage)
      ).rejects.toThrow('Either html or text content is required');
    });

    it('should include priority in dev mode logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test message',
        priority: EmailPriority.HIGH,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL DEV MODE]'),
        expect.objectContaining({
          priority: EmailPriority.HIGH,
        })
      );
    });
  });

  describe('sendBatch', () => {
    it('should send multiple emails in batch', async () => {
      const messages: EmailMessage[] = [
        { to: 'a@example.com', subject: 'Test 1', text: 'Message 1' },
        { to: 'b@example.com', subject: 'Test 2', text: 'Message 2' },
        { to: 'c@example.com', subject: 'Test 3', text: 'Message 3' },
      ];

      const result = await client.sendBatch(messages);

      expect(result.total).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle batch with invalid emails', async () => {
      const messages: EmailMessage[] = [
        { to: 'valid@example.com', subject: 'Test 1', text: 'Message 1' },
        { to: 'invalid-email', subject: 'Test 2', text: 'Message 2' },
        { to: 'another@example.com', subject: 'Test 3', text: 'Message 3' },
      ];

      const result = await client.sendBatch(messages);

      expect(result.total).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should stop on first error when stopOnError is true', async () => {
      const messages: EmailMessage[] = [
        { to: 'invalid-email', subject: 'Test 1', text: 'Message 1' },
        { to: 'valid@example.com', subject: 'Test 2', text: 'Message 2' },
      ];

      const result = await client.sendBatch(messages, { stopOnError: true });

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should respect batch size', async () => {
      const messages: EmailMessage[] = Array.from({ length: 15 }, (_, i) => ({
        to: `user${i}@example.com`,
        subject: `Test ${i}`,
        text: `Message ${i}`,
      }));

      const result = await client.sendBatch(messages, { batchSize: 5 });

      expect(result.total).toBe(15);
      expect(result.sent).toBe(15);
    });

    it('should handle empty batch', async () => {
      const result = await client.sendBatch([]);

      expect(result.total).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('event handling', () => {
    it('should emit sending event', async () => {
      const handler = vi.fn();
      client.on('email:sending', handler);

      await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email:sending',
          recipients: ['recipient@example.com'],
          subject: 'Test',
        })
      );
    });

    it('should emit sent event', async () => {
      const handler = vi.fn();
      client.on('email:sent', handler);

      await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email:sent',
          recipients: ['recipient@example.com'],
          subject: 'Test',
        })
      );
    });

    it('should return unsubscribe function', async () => {
      const handler = vi.fn();
      const unsubscribe = client.on('email:sent', handler);

      unsubscribe();

      await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple event handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.on('email:sent', handler1);
      client.on('email:sent', handler2);

      await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should catch errors in event handlers', async () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.on('email:sent', errorHandler);

      await client.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test message',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in email event handler'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance on subsequent calls', () => {
      resetEmailClient();
      const instance1 = getEmailClient();
      const instance2 = getEmailClient();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getEmailClient();
      resetEmailClient();
      const instance2 = getEmailClient();
      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('EmailClientError', () => {
  it('should create error with message and code', () => {
    const error = new EmailClientError('Test error', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('EmailClientError');
  });

  it('should set statusCode and retryable', () => {
    const error = new EmailClientError('Test error', 'TEST_CODE', {
      statusCode: 500,
      retryable: true,
    });
    expect(error.statusCode).toBe(500);
    expect(error.retryable).toBe(true);
  });

  it('should default retryable to false', () => {
    const error = new EmailClientError('Test error', 'TEST_CODE');
    expect(error.retryable).toBe(false);
  });

  it('should set cause', () => {
    const cause = new Error('Original error');
    const error = new EmailClientError('Test error', 'TEST_CODE', { cause });
    expect(error.cause).toBe(cause);
  });
});

describe('Email validation edge cases', () => {
  let client: EmailClient;

  beforeEach(() => {
    client = createEmailClient({
      apiKey: 'test_api_key',
      devMode: true,
    });
  });

  it('should handle whitespace-only subject', async () => {
    await expect(
      client.send({
        to: 'recipient@example.com',
        subject: '   ',
        text: 'Test message',
      })
    ).rejects.toThrow('Subject is required');
  });

  it('should handle array of recipients with one invalid', async () => {
    await expect(
      client.send({
        to: ['valid@example.com', 'invalid'],
        subject: 'Test',
        text: 'Test message',
      })
    ).rejects.toThrow('Invalid email address');
  });

  it('should handle recipient with empty email', async () => {
    await expect(
      client.send({
        to: { email: '', name: 'Test' },
        subject: 'Test',
        text: 'Test message',
      })
    ).rejects.toThrow('Invalid email address');
  });

  it('should handle CC and BCC recipients', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    await client.send({
      to: 'recipient@example.com',
      cc: 'cc@example.com',
      bcc: ['bcc1@example.com', 'bcc2@example.com'],
      subject: 'Test',
      text: 'Test message',
    });

    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should handle tags', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    await client.send({
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Test message',
      tags: { campaign: 'test', type: 'notification' },
    });

    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should handle custom headers', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    await client.send({
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Test message',
      headers: { 'X-Custom-Header': 'custom-value' },
    });

    expect(consoleSpy).toHaveBeenCalled();
  });
});
