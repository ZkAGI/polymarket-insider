/**
 * Unit tests for AlertDateRangeFilter component
 * Feature: UI-ALERT-005 - Alert date range filter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import types and helper functions
import type {
  AlertDateRangeFilterProps,
  ActiveDateRangeChipProps,
  CombinedDateFilterSummaryProps,
  DateRange,
} from '../../app/alerts/components/AlertDateRangeFilter';

import {
  DATE_RANGE_PRESETS,
  PRESET_LABELS,
  PRESET_ICONS,
  PRESET_DESCRIPTIONS,
  DEFAULT_DATE_RANGE,
  getStartOfToday,
  getEndOfToday,
  getStartOfYesterday,
  getEndOfYesterday,
  getStartOfThisWeek,
  getStartOfThisMonth,
  getStartOfThisYear,
  getDateRangeFromPreset,
  formatDateForDisplay,
  formatDateForInput,
  parseDateFromInput,
  getDateRangeLabel,
  isDateRangeActive,
  isDateInRange,
  validateDateRange,
} from '../../app/alerts/components/AlertDateRangeFilter';

// Mock React hooks for server-side testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn((initial) => [initial, vi.fn()]),
    useEffect: vi.fn(),
    useCallback: vi.fn((fn) => fn),
    useMemo: vi.fn((fn) => fn()),
    useRef: vi.fn(() => ({ current: null })),
  };
});

describe('AlertDateRangeFilter Constants', () => {
  describe('DATE_RANGE_PRESETS', () => {
    it('should contain all preset options', () => {
      expect(DATE_RANGE_PRESETS.length).toBe(10);
    });

    it('should contain ALL_TIME', () => {
      expect(DATE_RANGE_PRESETS).toContain('ALL_TIME');
    });

    it('should contain TODAY', () => {
      expect(DATE_RANGE_PRESETS).toContain('TODAY');
    });

    it('should contain YESTERDAY', () => {
      expect(DATE_RANGE_PRESETS).toContain('YESTERDAY');
    });

    it('should contain LAST_7_DAYS', () => {
      expect(DATE_RANGE_PRESETS).toContain('LAST_7_DAYS');
    });

    it('should contain LAST_30_DAYS', () => {
      expect(DATE_RANGE_PRESETS).toContain('LAST_30_DAYS');
    });

    it('should contain LAST_90_DAYS', () => {
      expect(DATE_RANGE_PRESETS).toContain('LAST_90_DAYS');
    });

    it('should contain THIS_WEEK', () => {
      expect(DATE_RANGE_PRESETS).toContain('THIS_WEEK');
    });

    it('should contain THIS_MONTH', () => {
      expect(DATE_RANGE_PRESETS).toContain('THIS_MONTH');
    });

    it('should contain THIS_YEAR', () => {
      expect(DATE_RANGE_PRESETS).toContain('THIS_YEAR');
    });

    it('should contain CUSTOM', () => {
      expect(DATE_RANGE_PRESETS).toContain('CUSTOM');
    });

    it('should not have duplicates', () => {
      const uniquePresets = new Set(DATE_RANGE_PRESETS);
      expect(uniquePresets.size).toBe(DATE_RANGE_PRESETS.length);
    });
  });

  describe('PRESET_LABELS', () => {
    it('should have label for ALL_TIME', () => {
      expect(PRESET_LABELS.ALL_TIME).toBe('All Time');
    });

    it('should have label for TODAY', () => {
      expect(PRESET_LABELS.TODAY).toBe('Today');
    });

    it('should have label for YESTERDAY', () => {
      expect(PRESET_LABELS.YESTERDAY).toBe('Yesterday');
    });

    it('should have label for LAST_7_DAYS', () => {
      expect(PRESET_LABELS.LAST_7_DAYS).toBe('Last 7 Days');
    });

    it('should have label for LAST_30_DAYS', () => {
      expect(PRESET_LABELS.LAST_30_DAYS).toBe('Last 30 Days');
    });

    it('should have label for LAST_90_DAYS', () => {
      expect(PRESET_LABELS.LAST_90_DAYS).toBe('Last 90 Days');
    });

    it('should have label for THIS_WEEK', () => {
      expect(PRESET_LABELS.THIS_WEEK).toBe('This Week');
    });

    it('should have label for THIS_MONTH', () => {
      expect(PRESET_LABELS.THIS_MONTH).toBe('This Month');
    });

    it('should have label for THIS_YEAR', () => {
      expect(PRESET_LABELS.THIS_YEAR).toBe('This Year');
    });

    it('should have label for CUSTOM', () => {
      expect(PRESET_LABELS.CUSTOM).toBe('Custom Range');
    });

    it('should have a label for each preset', () => {
      for (const preset of DATE_RANGE_PRESETS) {
        expect(PRESET_LABELS[preset]).toBeDefined();
        expect(PRESET_LABELS[preset].length).toBeGreaterThan(0);
      }
    });
  });

  describe('PRESET_ICONS', () => {
    it('should have icon for ALL_TIME', () => {
      expect(PRESET_ICONS.ALL_TIME).toBe('🗓️');
    });

    it('should have icon for TODAY', () => {
      expect(PRESET_ICONS.TODAY).toBe('📅');
    });

    it('should have icon for YESTERDAY', () => {
      expect(PRESET_ICONS.YESTERDAY).toBe('⬅️');
    });

    it('should have icon for CUSTOM', () => {
      expect(PRESET_ICONS.CUSTOM).toBe('✏️');
    });

    it('should have an icon for each preset', () => {
      for (const preset of DATE_RANGE_PRESETS) {
        expect(PRESET_ICONS[preset]).toBeDefined();
      }
    });
  });

  describe('PRESET_DESCRIPTIONS', () => {
    it('should have description for ALL_TIME', () => {
      expect(PRESET_DESCRIPTIONS.ALL_TIME).toContain('without date filtering');
    });

    it('should have description for TODAY', () => {
      expect(PRESET_DESCRIPTIONS.TODAY).toContain('today only');
    });

    it('should have description for YESTERDAY', () => {
      expect(PRESET_DESCRIPTIONS.YESTERDAY).toContain('yesterday only');
    });

    it('should have description for LAST_7_DAYS', () => {
      expect(PRESET_DESCRIPTIONS.LAST_7_DAYS).toContain('7 days');
    });

    it('should have description for LAST_30_DAYS', () => {
      expect(PRESET_DESCRIPTIONS.LAST_30_DAYS).toContain('30 days');
    });

    it('should have description for LAST_90_DAYS', () => {
      expect(PRESET_DESCRIPTIONS.LAST_90_DAYS).toContain('90 days');
    });

    it('should have description for CUSTOM', () => {
      expect(PRESET_DESCRIPTIONS.CUSTOM).toContain('custom');
    });

    it('should have a description for each preset', () => {
      for (const preset of DATE_RANGE_PRESETS) {
        expect(PRESET_DESCRIPTIONS[preset]).toBeDefined();
        expect(PRESET_DESCRIPTIONS[preset].length).toBeGreaterThan(10);
      }
    });
  });

  describe('DEFAULT_DATE_RANGE', () => {
    it('should have ALL_TIME preset', () => {
      expect(DEFAULT_DATE_RANGE.preset).toBe('ALL_TIME');
    });

    it('should have null startDate', () => {
      expect(DEFAULT_DATE_RANGE.startDate).toBeNull();
    });

    it('should have null endDate', () => {
      expect(DEFAULT_DATE_RANGE.endDate).toBeNull();
    });
  });
});

describe('AlertDateRangeFilter Date Helper Functions', () => {
  // Use a fixed date for consistent tests
  const fixedDate = new Date(2026, 0, 12, 12, 0, 0, 0); // Jan 12, 2026 at noon

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getStartOfToday', () => {
    it('should return a date at midnight', () => {
      const start = getStartOfToday();
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('should return today\'s date', () => {
      const start = getStartOfToday();
      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(0);
      expect(start.getDate()).toBe(12);
    });
  });

  describe('getEndOfToday', () => {
    it('should return a date at 23:59:59.999', () => {
      const end = getEndOfToday();
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });

    it('should return today\'s date', () => {
      const end = getEndOfToday();
      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(0);
      expect(end.getDate()).toBe(12);
    });
  });

  describe('getStartOfYesterday', () => {
    it('should return yesterday\'s date', () => {
      const yesterday = getStartOfYesterday();
      expect(yesterday.getFullYear()).toBe(2026);
      expect(yesterday.getMonth()).toBe(0);
      expect(yesterday.getDate()).toBe(11);
    });

    it('should return a date at midnight', () => {
      const yesterday = getStartOfYesterday();
      expect(yesterday.getHours()).toBe(0);
      expect(yesterday.getMinutes()).toBe(0);
      expect(yesterday.getSeconds()).toBe(0);
    });
  });

  describe('getEndOfYesterday', () => {
    it('should return yesterday\'s date', () => {
      const yesterday = getEndOfYesterday();
      expect(yesterday.getFullYear()).toBe(2026);
      expect(yesterday.getMonth()).toBe(0);
      expect(yesterday.getDate()).toBe(11);
    });

    it('should return a date at 23:59:59.999', () => {
      const yesterday = getEndOfYesterday();
      expect(yesterday.getHours()).toBe(23);
      expect(yesterday.getMinutes()).toBe(59);
      expect(yesterday.getSeconds()).toBe(59);
      expect(yesterday.getMilliseconds()).toBe(999);
    });
  });

  describe('getStartOfThisWeek', () => {
    it('should return Sunday of current week', () => {
      // Jan 12, 2026 is a Monday, so start of week is Jan 11 (Sunday)
      const weekStart = getStartOfThisWeek();
      expect(weekStart.getDay()).toBe(0); // Sunday
      expect(weekStart.getDate()).toBe(11);
    });

    it('should return a date at midnight', () => {
      const weekStart = getStartOfThisWeek();
      expect(weekStart.getHours()).toBe(0);
      expect(weekStart.getMinutes()).toBe(0);
      expect(weekStart.getSeconds()).toBe(0);
    });
  });

  describe('getStartOfThisMonth', () => {
    it('should return first day of current month', () => {
      const monthStart = getStartOfThisMonth();
      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(0);
      expect(monthStart.getFullYear()).toBe(2026);
    });

    it('should return a date at midnight', () => {
      const monthStart = getStartOfThisMonth();
      expect(monthStart.getHours()).toBe(0);
      expect(monthStart.getMinutes()).toBe(0);
      expect(monthStart.getSeconds()).toBe(0);
    });
  });

  describe('getStartOfThisYear', () => {
    it('should return first day of current year', () => {
      const yearStart = getStartOfThisYear();
      expect(yearStart.getDate()).toBe(1);
      expect(yearStart.getMonth()).toBe(0);
      expect(yearStart.getFullYear()).toBe(2026);
    });

    it('should return a date at midnight', () => {
      const yearStart = getStartOfThisYear();
      expect(yearStart.getHours()).toBe(0);
      expect(yearStart.getMinutes()).toBe(0);
      expect(yearStart.getSeconds()).toBe(0);
    });
  });
});

describe('getDateRangeFromPreset', () => {
  const fixedDate = new Date(2026, 0, 12, 12, 0, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null dates for ALL_TIME', () => {
    const range = getDateRangeFromPreset('ALL_TIME');
    expect(range.startDate).toBeNull();
    expect(range.endDate).toBeNull();
    expect(range.preset).toBe('ALL_TIME');
  });

  it('should return today\'s date range for TODAY', () => {
    const range = getDateRangeFromPreset('TODAY');
    expect(range.startDate?.getDate()).toBe(12);
    expect(range.endDate?.getDate()).toBe(12);
    expect(range.preset).toBe('TODAY');
  });

  it('should return yesterday\'s date range for YESTERDAY', () => {
    const range = getDateRangeFromPreset('YESTERDAY');
    expect(range.startDate?.getDate()).toBe(11);
    expect(range.endDate?.getDate()).toBe(11);
    expect(range.preset).toBe('YESTERDAY');
  });

  it('should return 7 day range for LAST_7_DAYS', () => {
    const range = getDateRangeFromPreset('LAST_7_DAYS');
    expect(range.startDate?.getDate()).toBe(6); // 12 - 6 = 6
    expect(range.endDate?.getDate()).toBe(12);
    expect(range.preset).toBe('LAST_7_DAYS');
  });

  it('should return 30 day range for LAST_30_DAYS', () => {
    const range = getDateRangeFromPreset('LAST_30_DAYS');
    expect(range.startDate).toBeDefined();
    expect(range.endDate?.getDate()).toBe(12);
    expect(range.preset).toBe('LAST_30_DAYS');
  });

  it('should return 90 day range for LAST_90_DAYS', () => {
    const range = getDateRangeFromPreset('LAST_90_DAYS');
    expect(range.startDate).toBeDefined();
    expect(range.endDate?.getDate()).toBe(12);
    expect(range.preset).toBe('LAST_90_DAYS');
  });

  it('should return start of week for THIS_WEEK', () => {
    const range = getDateRangeFromPreset('THIS_WEEK');
    expect(range.startDate?.getDay()).toBe(0); // Sunday
    expect(range.endDate?.getDate()).toBe(12);
    expect(range.preset).toBe('THIS_WEEK');
  });

  it('should return start of month for THIS_MONTH', () => {
    const range = getDateRangeFromPreset('THIS_MONTH');
    expect(range.startDate?.getDate()).toBe(1);
    expect(range.endDate?.getDate()).toBe(12);
    expect(range.preset).toBe('THIS_MONTH');
  });

  it('should return start of year for THIS_YEAR', () => {
    const range = getDateRangeFromPreset('THIS_YEAR');
    expect(range.startDate?.getMonth()).toBe(0);
    expect(range.startDate?.getDate()).toBe(1);
    expect(range.endDate?.getDate()).toBe(12);
    expect(range.preset).toBe('THIS_YEAR');
  });

  it('should return null dates for CUSTOM', () => {
    const range = getDateRangeFromPreset('CUSTOM');
    expect(range.startDate).toBeNull();
    expect(range.endDate).toBeNull();
    expect(range.preset).toBe('CUSTOM');
  });
});

describe('formatDateForDisplay', () => {
  it('should return empty string for null date', () => {
    expect(formatDateForDisplay(null)).toBe('');
  });

  it('should format date with short format', () => {
    const date = new Date(2026, 0, 12);
    const formatted = formatDateForDisplay(date, 'short');
    expect(formatted).toContain('Jan');
    expect(formatted).toContain('12');
  });

  it('should format date with long format', () => {
    const date = new Date(2026, 0, 12);
    const formatted = formatDateForDisplay(date, 'long');
    expect(formatted).toContain('Jan');
    expect(formatted).toContain('12');
    expect(formatted).toContain('2026');
  });

  it('should include year for dates not in current year (short format)', () => {
    const oldDate = new Date(2024, 5, 15);
    const formatted = formatDateForDisplay(oldDate, 'short');
    expect(formatted).toContain('2024');
  });
});

describe('formatDateForInput', () => {
  it('should return empty string for null date', () => {
    expect(formatDateForInput(null)).toBe('');
  });

  it('should format date as YYYY-MM-DD', () => {
    const date = new Date(2026, 0, 12);
    expect(formatDateForInput(date)).toBe('2026-01-12');
  });

  it('should pad single digit months and days', () => {
    const date = new Date(2026, 4, 5); // May 5
    expect(formatDateForInput(date)).toBe('2026-05-05');
  });
});

describe('parseDateFromInput', () => {
  it('should return null for empty string', () => {
    expect(parseDateFromInput('')).toBeNull();
  });

  it('should parse YYYY-MM-DD format', () => {
    const parsed = parseDateFromInput('2026-01-12');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(12);
  });

  it('should return null for invalid format', () => {
    expect(parseDateFromInput('invalid')).toBeNull();
  });

  it('should set time to midnight', () => {
    const parsed = parseDateFromInput('2026-01-12');
    expect(parsed?.getHours()).toBe(0);
    expect(parsed?.getMinutes()).toBe(0);
    expect(parsed?.getSeconds()).toBe(0);
  });
});

describe('getDateRangeLabel', () => {
  it('should return "All Time" for ALL_TIME preset', () => {
    const range: DateRange = { startDate: null, endDate: null, preset: 'ALL_TIME' };
    expect(getDateRangeLabel(range)).toBe('All Time');
  });

  it('should return preset label for non-custom presets', () => {
    const range: DateRange = { startDate: new Date(), endDate: new Date(), preset: 'TODAY' };
    expect(getDateRangeLabel(range)).toBe('Today');
  });

  it('should return formatted date range for custom with both dates', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 15);
    const range: DateRange = { startDate: start, endDate: end, preset: 'CUSTOM' };
    const label = getDateRangeLabel(range);
    expect(label).toContain('Jan');
    expect(label).toContain('-');
  });

  it('should return single date if start and end are same day', () => {
    const date = new Date(2026, 0, 12);
    const range: DateRange = { startDate: date, endDate: date, preset: 'CUSTOM' };
    const label = getDateRangeLabel(range);
    expect(label).toContain('Jan');
    expect(label).toContain('12');
    expect(label).not.toContain('-');
  });

  it('should return "From" label if only start date', () => {
    const range: DateRange = { startDate: new Date(2026, 0, 1), endDate: null, preset: 'CUSTOM' };
    expect(getDateRangeLabel(range)).toContain('From');
  });

  it('should return "Until" label if only end date', () => {
    const range: DateRange = { startDate: null, endDate: new Date(2026, 0, 15), preset: 'CUSTOM' };
    expect(getDateRangeLabel(range)).toContain('Until');
  });

  it('should return "Select dates" if custom with no dates', () => {
    const range: DateRange = { startDate: null, endDate: null, preset: 'CUSTOM' };
    expect(getDateRangeLabel(range)).toBe('Select dates');
  });
});

describe('isDateRangeActive', () => {
  it('should return false for ALL_TIME preset', () => {
    const range: DateRange = { startDate: null, endDate: null, preset: 'ALL_TIME' };
    expect(isDateRangeActive(range)).toBe(false);
  });

  it('should return true for TODAY preset', () => {
    const range: DateRange = { startDate: new Date(), endDate: new Date(), preset: 'TODAY' };
    expect(isDateRangeActive(range)).toBe(true);
  });

  it('should return true for YESTERDAY preset', () => {
    const range: DateRange = { startDate: new Date(), endDate: new Date(), preset: 'YESTERDAY' };
    expect(isDateRangeActive(range)).toBe(true);
  });

  it('should return true for LAST_7_DAYS preset', () => {
    const range: DateRange = { startDate: new Date(), endDate: new Date(), preset: 'LAST_7_DAYS' };
    expect(isDateRangeActive(range)).toBe(true);
  });

  it('should return true for CUSTOM preset', () => {
    const range: DateRange = { startDate: new Date(), endDate: new Date(), preset: 'CUSTOM' };
    expect(isDateRangeActive(range)).toBe(true);
  });
});

describe('isDateInRange', () => {
  const fixedDate = new Date(2026, 0, 12, 12, 0, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true for ALL_TIME preset', () => {
    const range: DateRange = { startDate: null, endDate: null, preset: 'ALL_TIME' };
    const date = new Date(2020, 0, 1);
    expect(isDateInRange(date, range)).toBe(true);
  });

  it('should return true for date within range', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 31);
    const range: DateRange = { startDate: start, endDate: end, preset: 'CUSTOM' };
    const date = new Date(2026, 0, 15);
    expect(isDateInRange(date, range)).toBe(true);
  });

  it('should return false for date before start', () => {
    const start = new Date(2026, 0, 10);
    const end = new Date(2026, 0, 31);
    const range: DateRange = { startDate: start, endDate: end, preset: 'CUSTOM' };
    const date = new Date(2026, 0, 5);
    expect(isDateInRange(date, range)).toBe(false);
  });

  it('should return false for date after end', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 10);
    const range: DateRange = { startDate: start, endDate: end, preset: 'CUSTOM' };
    const date = new Date(2026, 0, 15);
    expect(isDateInRange(date, range)).toBe(false);
  });

  it('should return true for date on start boundary', () => {
    const start = new Date(2026, 0, 10, 0, 0, 0, 0);
    const end = new Date(2026, 0, 31, 23, 59, 59, 999);
    const range: DateRange = { startDate: start, endDate: end, preset: 'CUSTOM' };
    const date = new Date(2026, 0, 10, 12, 0, 0, 0);
    expect(isDateInRange(date, range)).toBe(true);
  });

  it('should return true for date on end boundary', () => {
    const start = new Date(2026, 0, 1, 0, 0, 0, 0);
    const end = new Date(2026, 0, 10, 23, 59, 59, 999);
    const range: DateRange = { startDate: start, endDate: end, preset: 'CUSTOM' };
    const date = new Date(2026, 0, 10, 12, 0, 0, 0);
    expect(isDateInRange(date, range)).toBe(true);
  });
});

describe('validateDateRange', () => {
  it('should return valid for null dates', () => {
    const result = validateDateRange(null, null);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return valid for valid date range', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 15);
    const result = validateDateRange(start, end);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return error when start is after end', () => {
    const start = new Date(2026, 0, 15);
    const end = new Date(2026, 0, 1);
    const result = validateDateRange(start, end);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Start date must be before end date');
  });

  it('should return error when start date is in future', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const result = validateDateRange(futureDate, null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be in the future');
  });

  it('should return valid when same start and end date', () => {
    const date = new Date(2026, 0, 12);
    const result = validateDateRange(date, date);
    expect(result.valid).toBe(true);
  });

  it('should return valid for only start date (past)', () => {
    const start = new Date(2025, 0, 1);
    const result = validateDateRange(start, null);
    expect(result.valid).toBe(true);
  });

  it('should return valid for only end date', () => {
    const end = new Date(2026, 0, 15);
    const result = validateDateRange(null, end);
    expect(result.valid).toBe(true);
  });
});

describe('AlertDateRangeFilter Props Interfaces', () => {
  describe('AlertDateRangeFilterProps', () => {
    it('should accept required props', () => {
      const props: AlertDateRangeFilterProps = {
        dateRange: DEFAULT_DATE_RANGE,
        onChange: vi.fn(),
      };
      expect(props.dateRange).toBeDefined();
      expect(props.onChange).toBeDefined();
    });

    it('should accept optional props', () => {
      const props: AlertDateRangeFilterProps = {
        dateRange: DEFAULT_DATE_RANGE,
        onChange: vi.fn(),
        disabled: true,
        timezone: 'America/New_York',
        testId: 'test-filter',
      };
      expect(props.disabled).toBe(true);
      expect(props.timezone).toBe('America/New_York');
      expect(props.testId).toBe('test-filter');
    });
  });

  describe('ActiveDateRangeChipProps', () => {
    it('should accept required props', () => {
      const props: ActiveDateRangeChipProps = {
        dateRange: DEFAULT_DATE_RANGE,
        onClear: vi.fn(),
      };
      expect(props.dateRange).toBeDefined();
      expect(props.onClear).toBeDefined();
    });

    it('should accept optional testId', () => {
      const props: ActiveDateRangeChipProps = {
        dateRange: DEFAULT_DATE_RANGE,
        onClear: vi.fn(),
        testId: 'test-chip',
      };
      expect(props.testId).toBe('test-chip');
    });
  });

  describe('CombinedDateFilterSummaryProps', () => {
    it('should accept required props', () => {
      const props: CombinedDateFilterSummaryProps = {
        totalAlerts: 100,
        filteredAlerts: 50,
        hasTypeFilters: false,
        hasSeverityFilters: false,
        hasDateFilter: true,
        onClearAll: vi.fn(),
      };
      expect(props.totalAlerts).toBe(100);
      expect(props.filteredAlerts).toBe(50);
      expect(props.hasDateFilter).toBe(true);
    });
  });

  describe('DateRange interface', () => {
    it('should accept valid date range', () => {
      const range: DateRange = {
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 0, 31),
        preset: 'CUSTOM',
      };
      expect(range.startDate).toBeDefined();
      expect(range.endDate).toBeDefined();
      expect(range.preset).toBe('CUSTOM');
    });

    it('should accept null dates', () => {
      const range: DateRange = {
        startDate: null,
        endDate: null,
        preset: 'ALL_TIME',
      };
      expect(range.startDate).toBeNull();
      expect(range.endDate).toBeNull();
    });
  });
});

describe('Preset Coverage Tests', () => {
  const fixedDate = new Date(2026, 0, 12, 12, 0, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should generate valid ranges for all presets', () => {
    for (const preset of DATE_RANGE_PRESETS) {
      const range = getDateRangeFromPreset(preset);
      expect(range.preset).toBe(preset);

      if (preset === 'ALL_TIME' || preset === 'CUSTOM') {
        expect(range.startDate).toBeNull();
        expect(range.endDate).toBeNull();
      } else {
        expect(range.startDate).not.toBeNull();
        expect(range.endDate).not.toBeNull();
        expect(range.startDate!.getTime()).toBeLessThanOrEqual(range.endDate!.getTime());
      }
    }
  });

  it('should have proper end of day for all presets with dates', () => {
    for (const preset of DATE_RANGE_PRESETS) {
      if (preset !== 'ALL_TIME' && preset !== 'CUSTOM') {
        const range = getDateRangeFromPreset(preset);
        if (range.endDate) {
          expect(range.endDate.getHours()).toBe(23);
          expect(range.endDate.getMinutes()).toBe(59);
          expect(range.endDate.getSeconds()).toBe(59);
        }
      }
    }
  });
});

describe('Edge Cases', () => {
  describe('Date Parsing Edge Cases', () => {
    it('should handle invalid date parts', () => {
      expect(parseDateFromInput('2026-00-00')).toBeNull();
    });

    it('should handle partial date string', () => {
      expect(parseDateFromInput('2026-01')).toBeNull();
    });

    it('should handle date with extra characters', () => {
      // This should still work since split handles extra parts
      const parsed = parseDateFromInput('2026-01-12-extra');
      expect(parsed).not.toBeNull();
      expect(parsed?.getDate()).toBe(12);
    });
  });

  describe('Date Range Edge Cases', () => {
    it('should handle year boundary', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 0)); // Jan 1

      const range = getDateRangeFromPreset('YESTERDAY');
      expect(range.startDate?.getFullYear()).toBe(2025);
      expect(range.startDate?.getMonth()).toBe(11); // December
      expect(range.startDate?.getDate()).toBe(31);

      vi.useRealTimers();
    });

    it('should handle month boundary', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 1, 12, 0, 0, 0)); // Feb 1

      const range = getDateRangeFromPreset('YESTERDAY');
      expect(range.startDate?.getMonth()).toBe(0); // January
      expect(range.startDate?.getDate()).toBe(31);

      vi.useRealTimers();
    });

    it('should handle start of year for THIS_YEAR', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 0)); // Jan 1

      const range = getDateRangeFromPreset('THIS_YEAR');
      expect(range.startDate?.getFullYear()).toBe(2026);
      expect(range.startDate?.getMonth()).toBe(0);
      expect(range.startDate?.getDate()).toBe(1);

      vi.useRealTimers();
    });
  });
});
