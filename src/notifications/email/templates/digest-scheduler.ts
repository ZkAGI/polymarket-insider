/**
 * Digest email scheduling system
 * Handles timezone-aware scheduling and sending of daily digest emails
 */

import { EventEmitter } from 'events';
import {
  DigestScheduleConfig,
  DEFAULT_SCHEDULE_CONFIG,
  DailyDigestData,
  DigestEmailOptions,
} from './digest-types';
import { createDigestEmailMessage } from './digest-template';

/**
 * Supported timezone names (IANA timezone database)
 */
export const SUPPORTED_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number];

/**
 * Scheduled job configuration
 */
export interface ScheduledDigestJob {
  id: string;
  config: DigestScheduleConfig;
  nextRunTime: Date;
  lastRunTime?: Date;
  lastRunStatus?: 'success' | 'failed';
  lastError?: string;
  isActive: boolean;
}

/**
 * Scheduler event types
 */
export type DigestSchedulerEventType =
  | 'scheduler:started'
  | 'scheduler:stopped'
  | 'job:scheduled'
  | 'job:running'
  | 'job:completed'
  | 'job:failed'
  | 'job:removed';

/**
 * Scheduler event data
 */
export interface DigestSchedulerEvent {
  type: DigestSchedulerEventType;
  timestamp: Date;
  jobId?: string;
  recipientEmail?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Digest data provider function type
 */
export type DigestDataProvider = (
  recipientEmail: string,
  timezone: string,
  digestDate: Date
) => Promise<DailyDigestData>;

/**
 * Email send function type
 */
export type EmailSendFunction = (
  message: { to: string; subject: string; html: string; text: string }
) => Promise<{ id: string; status: string }>;

/**
 * Scheduler configuration
 */
export interface DigestSchedulerConfig {
  /** Check interval in milliseconds */
  checkInterval?: number;
  /** Grace period in milliseconds for considering a job due */
  gracePeriod?: number;
  /** Maximum concurrent jobs */
  maxConcurrentJobs?: number;
  /** Retry attempts on failure */
  retryAttempts?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

const DEFAULT_SCHEDULER_CONFIG: DigestSchedulerConfig = {
  checkInterval: 60000, // 1 minute
  gracePeriod: 300000, // 5 minutes
  maxConcurrentJobs: 5,
  retryAttempts: 3,
  retryDelay: 5000,
};

/**
 * Validate timezone string
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current time in a specific timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Parse the formatted date parts
  const parts = formatter.formatToParts(now);
  const getPart = (type: string): string =>
    parts.find(p => p.type === type)?.value || '0';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10) - 1;
  const day = parseInt(getPart('day'), 10);
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);

  // Create a date object in the target timezone (for local time reference)
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Get hour and minute in a specific timezone
 */
export function getTimeComponentsInTimezone(date: Date, timezone: string): { hour: number; minute: number; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const weekday = parts.find(p => p.type === 'weekday')?.value || 'Sun';

  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
  };

  return { hour, minute, dayOfWeek: dayMap[weekday] ?? 0 };
}

/**
 * Calculate next run time based on schedule configuration
 */
export function calculateNextRunTime(config: DigestScheduleConfig, fromDate?: Date): Date {
  const now = fromDate || new Date();
  // Get current time components (used in loop)
  void getTimeComponentsInTimezone(now, config.timezone);

  // Start searching from now
  let candidate = new Date(now);
  let daysChecked = 0;
  const maxDays = 8; // Check up to a week ahead plus one day

  while (daysChecked < maxDays) {
    const { dayOfWeek } = getTimeComponentsInTimezone(candidate, config.timezone);

    // Check if this day is enabled
    if (config.daysOfWeek.includes(dayOfWeek)) {
      // Check if the scheduled time hasn't passed yet today
      const { hour, minute } = getTimeComponentsInTimezone(candidate, config.timezone);

      if (daysChecked === 0) {
        // For today, only consider if time hasn't passed
        if (hour < config.sendHour ||
            (hour === config.sendHour && minute < config.sendMinute)) {
          // Time hasn't passed, schedule for today
          break;
        }
      } else {
        // For future days, any enabled day works
        break;
      }
    }

    // Move to next day
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    candidate.setUTCHours(0, 0, 0, 0);
    daysChecked++;
  }

  // Set the exact time
  // Calculate offset to get to the target time in the target timezone
  const targetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });

  const parts = targetFormatter.formatToParts(candidate);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2024', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);

  // Create date at target time
  const targetDate = new Date(Date.UTC(year, month, day, config.sendHour, config.sendMinute, 0));

  // Adjust for timezone offset
  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    timeZoneName: 'longOffset',
  });
  const offsetString = offsetFormatter.format(targetDate);
  const offsetMatch = offsetString.match(/GMT([+-]\d{2}):?(\d{2})?/);

  if (offsetMatch && offsetMatch[1]) {
    const offsetHours = parseInt(offsetMatch[1], 10);
    const offsetMinutes = parseInt(offsetMatch[2] || '0', 10);
    const totalOffsetMinutes = (offsetHours * 60) + (offsetHours >= 0 ? offsetMinutes : -offsetMinutes);

    // Subtract offset to get UTC time (if GMT+5, we subtract 5 hours to get UTC)
    return new Date(targetDate.getTime() - totalOffsetMinutes * 60 * 1000);
  }

  return targetDate;
}

/**
 * Check if a scheduled time is due
 */
export function isScheduledTimeDue(
  scheduledTime: Date,
  gracePeriod: number = DEFAULT_SCHEDULER_CONFIG.gracePeriod!
): boolean {
  const now = new Date();
  const diff = now.getTime() - scheduledTime.getTime();

  // Due if we're past the scheduled time but within grace period
  return diff >= 0 && diff <= gracePeriod;
}

/**
 * Get the digest date (the day being summarized) from a run time
 */
export function getDigestDateFromRunTime(runTime: Date, timezone: string): Date {
  // The digest covers the previous day
  const previousDay = new Date(runTime.getTime() - 24 * 60 * 60 * 1000);

  // Get just the date portion in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(previousDay);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2024', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);

  return new Date(Date.UTC(year, month, day, 0, 0, 0));
}

/**
 * DigestScheduler class
 * Manages scheduling and sending of daily digest emails
 */
export class DigestScheduler extends EventEmitter {
  private jobs: Map<string, ScheduledDigestJob> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private config: DigestSchedulerConfig;
  private dataProvider: DigestDataProvider | null = null;
  private emailSender: EmailSendFunction | null = null;
  private emailOptions: DigestEmailOptions = {};
  private isRunning: boolean = false;
  private activeJobs: Set<string> = new Set();

  constructor(config?: Partial<DigestSchedulerConfig>) {
    super();
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }

  /**
   * Set the data provider function
   */
  setDataProvider(provider: DigestDataProvider): void {
    this.dataProvider = provider;
  }

  /**
   * Set the email send function
   */
  setEmailSender(sender: EmailSendFunction): void {
    this.emailSender = sender;
  }

  /**
   * Set email rendering options
   */
  setEmailOptions(options: DigestEmailOptions): void {
    this.emailOptions = options;
  }

  /**
   * Add or update a scheduled digest job
   */
  scheduleDigest(config: DigestScheduleConfig): ScheduledDigestJob {
    const jobId = `digest-${config.recipientEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;

    const existingJob = this.jobs.get(jobId);
    const nextRunTime = config.enabled
      ? calculateNextRunTime(config)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Far future if disabled

    const job: ScheduledDigestJob = {
      id: jobId,
      config,
      nextRunTime,
      lastRunTime: existingJob?.lastRunTime,
      lastRunStatus: existingJob?.lastRunStatus,
      lastError: existingJob?.lastError,
      isActive: config.enabled,
    };

    this.jobs.set(jobId, job);

    this.emit('job:scheduled', {
      type: 'job:scheduled',
      timestamp: new Date(),
      jobId,
      recipientEmail: config.recipientEmail,
      metadata: { nextRunTime: nextRunTime.toISOString() },
    } as DigestSchedulerEvent);

    return job;
  }

  /**
   * Remove a scheduled job
   */
  removeJob(recipientEmail: string): boolean {
    const jobId = `digest-${recipientEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const job = this.jobs.get(jobId);

    if (job) {
      this.jobs.delete(jobId);

      this.emit('job:removed', {
        type: 'job:removed',
        timestamp: new Date(),
        jobId,
        recipientEmail,
      } as DigestSchedulerEvent);

      return true;
    }

    return false;
  }

  /**
   * Get a job by email address
   */
  getJob(recipientEmail: string): ScheduledDigestJob | undefined {
    const jobId = `digest-${recipientEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return this.jobs.get(jobId);
  }

  /**
   * Get all scheduled jobs
   */
  getAllJobs(): ScheduledDigestJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs due for execution
   */
  getDueJobs(): ScheduledDigestJob[] {
    const gracePeriod = this.config.gracePeriod || DEFAULT_SCHEDULER_CONFIG.gracePeriod!;

    return Array.from(this.jobs.values())
      .filter(job =>
        job.isActive &&
        !this.activeJobs.has(job.id) &&
        isScheduledTimeDue(job.nextRunTime, gracePeriod)
      );
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.checkInterval = setInterval(
      () => this.checkAndRunDueJobs(),
      this.config.checkInterval
    );

    this.emit('scheduler:started', {
      type: 'scheduler:started',
      timestamp: new Date(),
      metadata: { jobCount: this.jobs.size },
    } as DigestSchedulerEvent);

    // Run initial check
    this.checkAndRunDueJobs();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.emit('scheduler:stopped', {
      type: 'scheduler:stopped',
      timestamp: new Date(),
      metadata: { activeJobs: this.activeJobs.size },
    } as DigestSchedulerEvent);
  }

  /**
   * Check for due jobs and run them
   */
  private async checkAndRunDueJobs(): Promise<void> {
    const dueJobs = this.getDueJobs();

    // Limit concurrent jobs
    const maxConcurrent = this.config.maxConcurrentJobs || DEFAULT_SCHEDULER_CONFIG.maxConcurrentJobs!;
    const availableSlots = maxConcurrent - this.activeJobs.size;
    const jobsToRun = dueJobs.slice(0, availableSlots);

    await Promise.all(jobsToRun.map(job => this.runJob(job)));
  }

  /**
   * Run a single digest job
   */
  private async runJob(job: ScheduledDigestJob): Promise<void> {
    if (!this.dataProvider || !this.emailSender) {
      this.updateJobError(job, 'Data provider or email sender not configured');
      return;
    }

    this.activeJobs.add(job.id);

    this.emit('job:running', {
      type: 'job:running',
      timestamp: new Date(),
      jobId: job.id,
      recipientEmail: job.config.recipientEmail,
    } as DigestSchedulerEvent);

    try {
      // Get the digest date (previous day)
      const digestDate = getDigestDateFromRunTime(new Date(), job.config.timezone);

      // Fetch digest data
      const digestData = await this.dataProvider(
        job.config.recipientEmail,
        job.config.timezone,
        digestDate
      );

      // Add recipient name if configured
      if (job.config.recipientName) {
        digestData.recipientName = job.config.recipientName;
      }

      // Create email message
      const message = createDigestEmailMessage(
        digestData,
        job.config.recipientEmail,
        { ...this.emailOptions, timezone: job.config.timezone }
      );

      // Send email with retry logic
      await this.sendWithRetry(message);

      // Update job status
      this.updateJobSuccess(job);

      this.emit('job:completed', {
        type: 'job:completed',
        timestamp: new Date(),
        jobId: job.id,
        recipientEmail: job.config.recipientEmail,
      } as DigestSchedulerEvent);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateJobError(job, errorMessage);

      this.emit('job:failed', {
        type: 'job:failed',
        timestamp: new Date(),
        jobId: job.id,
        recipientEmail: job.config.recipientEmail,
        error: errorMessage,
      } as DigestSchedulerEvent);

    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Send email with retry logic
   */
  private async sendWithRetry(message: { to: string; subject: string; html: string; text: string }): Promise<void> {
    const maxAttempts = this.config.retryAttempts || DEFAULT_SCHEDULER_CONFIG.retryAttempts!;
    const retryDelay = this.config.retryDelay || DEFAULT_SCHEDULER_CONFIG.retryDelay!;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.emailSender!(message);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    throw lastError || new Error('Failed to send email after retries');
  }

  /**
   * Update job after successful run
   */
  private updateJobSuccess(job: ScheduledDigestJob): void {
    job.lastRunTime = new Date();
    job.lastRunStatus = 'success';
    job.lastError = undefined;
    job.nextRunTime = calculateNextRunTime(job.config, new Date(Date.now() + 60000)); // Add 1 minute buffer
    this.jobs.set(job.id, job);
  }

  /**
   * Update job after failed run
   */
  private updateJobError(job: ScheduledDigestJob, error: string): void {
    job.lastRunTime = new Date();
    job.lastRunStatus = 'failed';
    job.lastError = error;
    // Still schedule next run even on failure
    job.nextRunTime = calculateNextRunTime(job.config, new Date(Date.now() + 60000));
    this.jobs.set(job.id, job);
  }

  /**
   * Manually trigger a digest for testing
   */
  async triggerDigest(recipientEmail: string): Promise<void> {
    const job = this.getJob(recipientEmail);

    if (!job) {
      throw new Error(`No job found for ${recipientEmail}`);
    }

    await this.runJob(job);
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    totalJobs: number;
    activeJobs: number;
    nextDueJob?: { email: string; time: Date };
  } {
    const allJobs = this.getAllJobs();
    const activeJob = allJobs
      .filter(j => j.isActive)
      .sort((a, b) => a.nextRunTime.getTime() - b.nextRunTime.getTime())[0];

    return {
      isRunning: this.isRunning,
      totalJobs: allJobs.length,
      activeJobs: this.activeJobs.size,
      nextDueJob: activeJob
        ? { email: activeJob.config.recipientEmail, time: activeJob.nextRunTime }
        : undefined,
    };
  }
}

/**
 * Create a default scheduler instance
 */
export function createDigestScheduler(config?: Partial<DigestSchedulerConfig>): DigestScheduler {
  return new DigestScheduler(config);
}

/**
 * Validate schedule configuration
 */
export function validateScheduleConfig(config: unknown): config is DigestScheduleConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const c = config as Record<string, unknown>;

  if (typeof c.enabled !== 'boolean') {
    return false;
  }
  if (typeof c.sendHour !== 'number' || c.sendHour < 0 || c.sendHour > 23) {
    return false;
  }
  if (typeof c.sendMinute !== 'number' || c.sendMinute < 0 || c.sendMinute > 59) {
    return false;
  }
  if (typeof c.timezone !== 'string' || !isValidTimezone(c.timezone)) {
    return false;
  }
  if (!Array.isArray(c.daysOfWeek) || !c.daysOfWeek.every(d => typeof d === 'number' && d >= 0 && d <= 6)) {
    return false;
  }
  if (typeof c.recipientEmail !== 'string' || !c.recipientEmail.includes('@')) {
    return false;
  }

  return true;
}

/**
 * Create a schedule config with defaults
 */
export function createScheduleConfig(
  recipientEmail: string,
  overrides?: Partial<DigestScheduleConfig>
): DigestScheduleConfig {
  return {
    ...DEFAULT_SCHEDULE_CONFIG,
    recipientEmail,
    ...overrides,
  };
}
