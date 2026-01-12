'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Date range preset types
export type DateRangePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'LAST_90_DAYS'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'THIS_YEAR'
  | 'CUSTOM'
  | 'ALL_TIME';

// All available preset options
export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  'ALL_TIME',
  'TODAY',
  'YESTERDAY',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'THIS_WEEK',
  'THIS_MONTH',
  'THIS_YEAR',
  'CUSTOM',
];

// Preset labels (human-readable)
export const PRESET_LABELS: Record<DateRangePreset, string> = {
  ALL_TIME: 'All Time',
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  LAST_7_DAYS: 'Last 7 Days',
  LAST_30_DAYS: 'Last 30 Days',
  LAST_90_DAYS: 'Last 90 Days',
  THIS_WEEK: 'This Week',
  THIS_MONTH: 'This Month',
  THIS_YEAR: 'This Year',
  CUSTOM: 'Custom Range',
};

// Preset icons
export const PRESET_ICONS: Record<DateRangePreset, string> = {
  ALL_TIME: '🗓️',
  TODAY: '📅',
  YESTERDAY: '⬅️',
  LAST_7_DAYS: '7️⃣',
  LAST_30_DAYS: '📆',
  LAST_90_DAYS: '🗃️',
  THIS_WEEK: '📅',
  THIS_MONTH: '📁',
  THIS_YEAR: '🗄️',
  CUSTOM: '✏️',
};

// Preset descriptions for accessibility
export const PRESET_DESCRIPTIONS: Record<DateRangePreset, string> = {
  ALL_TIME: 'Show all alerts without date filtering',
  TODAY: 'Show alerts from today only',
  YESTERDAY: 'Show alerts from yesterday only',
  LAST_7_DAYS: 'Show alerts from the past 7 days',
  LAST_30_DAYS: 'Show alerts from the past 30 days',
  LAST_90_DAYS: 'Show alerts from the past 90 days',
  THIS_WEEK: 'Show alerts from the current week (Sunday to today)',
  THIS_MONTH: 'Show alerts from the current month',
  THIS_YEAR: 'Show alerts from the current year',
  CUSTOM: 'Select a custom date range',
};

// Date range value
export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
  preset: DateRangePreset;
}

// Default date range (all time)
export const DEFAULT_DATE_RANGE: DateRange = {
  startDate: null,
  endDate: null,
  preset: 'ALL_TIME',
};

// Component props
export interface AlertDateRangeFilterProps {
  dateRange: DateRange;
  onChange: (dateRange: DateRange) => void;
  disabled?: boolean;
  timezone?: string;
  testId?: string;
}

// Get the start of today in local timezone
export function getStartOfToday(timezone?: string): Date {
  const now = new Date();
  if (timezone) {
    // Use Intl API for timezone-aware date handling
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

// Get the end of today in local timezone
export function getEndOfToday(timezone?: string): Date {
  const start = getStartOfToday(timezone);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
}

// Get the start of yesterday
export function getStartOfYesterday(timezone?: string): Date {
  const today = getStartOfToday(timezone);
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 0, 0, 0, 0);
}

// Get the end of yesterday
export function getEndOfYesterday(timezone?: string): Date {
  const yesterday = getStartOfYesterday(timezone);
  return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
}

// Get the start of this week (Sunday)
export function getStartOfThisWeek(timezone?: string): Date {
  const today = getStartOfToday(timezone);
  const dayOfWeek = today.getDay(); // 0 = Sunday
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek, 0, 0, 0, 0);
}

// Get the start of this month
export function getStartOfThisMonth(timezone?: string): Date {
  const today = getStartOfToday(timezone);
  return new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
}

// Get the start of this year
export function getStartOfThisYear(timezone?: string): Date {
  const today = getStartOfToday(timezone);
  return new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
}

// Get date range from preset
export function getDateRangeFromPreset(preset: DateRangePreset, timezone?: string): DateRange {
  const today = getStartOfToday(timezone);
  const endOfToday = getEndOfToday(timezone);

  switch (preset) {
    case 'ALL_TIME':
      return { startDate: null, endDate: null, preset };
    case 'TODAY':
      return { startDate: today, endDate: endOfToday, preset };
    case 'YESTERDAY':
      return { startDate: getStartOfYesterday(timezone), endDate: getEndOfYesterday(timezone), preset };
    case 'LAST_7_DAYS':
      return {
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6, 0, 0, 0, 0),
        endDate: endOfToday,
        preset,
      };
    case 'LAST_30_DAYS':
      return {
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29, 0, 0, 0, 0),
        endDate: endOfToday,
        preset,
      };
    case 'LAST_90_DAYS':
      return {
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89, 0, 0, 0, 0),
        endDate: endOfToday,
        preset,
      };
    case 'THIS_WEEK':
      return { startDate: getStartOfThisWeek(timezone), endDate: endOfToday, preset };
    case 'THIS_MONTH':
      return { startDate: getStartOfThisMonth(timezone), endDate: endOfToday, preset };
    case 'THIS_YEAR':
      return { startDate: getStartOfThisYear(timezone), endDate: endOfToday, preset };
    case 'CUSTOM':
    default:
      return { startDate: null, endDate: null, preset: 'CUSTOM' };
  }
}

// Format date for display
export function formatDateForDisplay(date: Date | null, format: 'short' | 'long' = 'short'): string {
  if (!date) return '';

  if (format === 'long') {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

// Format date for input (YYYY-MM-DD)
export function formatDateForInput(date: Date | null): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse date from input (YYYY-MM-DD)
export function parseDateFromInput(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

// Get display label for date range
export function getDateRangeLabel(dateRange: DateRange): string {
  if (dateRange.preset === 'ALL_TIME') {
    return 'All Time';
  }

  if (dateRange.preset !== 'CUSTOM') {
    return PRESET_LABELS[dateRange.preset];
  }

  // Custom range
  if (dateRange.startDate && dateRange.endDate) {
    const start = formatDateForDisplay(dateRange.startDate);
    const end = formatDateForDisplay(dateRange.endDate);
    if (start === end) {
      return start;
    }
    return `${start} - ${end}`;
  }

  if (dateRange.startDate) {
    return `From ${formatDateForDisplay(dateRange.startDate)}`;
  }

  if (dateRange.endDate) {
    return `Until ${formatDateForDisplay(dateRange.endDate)}`;
  }

  return 'Select dates';
}

// Check if date range is active (not all time)
export function isDateRangeActive(dateRange: DateRange): boolean {
  return dateRange.preset !== 'ALL_TIME';
}

// Check if a date is within the range
export function isDateInRange(date: Date, dateRange: DateRange): boolean {
  if (dateRange.preset === 'ALL_TIME') {
    return true;
  }

  const timestamp = date.getTime();

  if (dateRange.startDate && timestamp < dateRange.startDate.getTime()) {
    return false;
  }

  if (dateRange.endDate && timestamp > dateRange.endDate.getTime()) {
    return false;
  }

  return true;
}

// Validate custom date range
export function validateDateRange(startDate: Date | null, endDate: Date | null): { valid: boolean; error?: string } {
  if (!startDate && !endDate) {
    return { valid: true };
  }

  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    return { valid: false, error: 'Start date must be before end date' };
  }

  const now = new Date();
  if (startDate && startDate.getTime() > now.getTime()) {
    return { valid: false, error: 'Start date cannot be in the future' };
  }

  return { valid: true };
}

// Main AlertDateRangeFilter component
export default function AlertDateRangeFilter({
  dateRange,
  onChange,
  disabled = false,
  timezone,
  testId = 'alert-date-range-filter',
}: AlertDateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomInputs, setShowCustomInputs] = useState(dateRange.preset === 'CUSTOM');
  const [customStartDate, setCustomStartDate] = useState(formatDateForInput(dateRange.startDate));
  const [customEndDate, setCustomEndDate] = useState(formatDateForInput(dateRange.endDate));
  const [validationError, setValidationError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync custom inputs with dateRange prop
  useEffect(() => {
    if (dateRange.preset === 'CUSTOM') {
      setShowCustomInputs(true);
      setCustomStartDate(formatDateForInput(dateRange.startDate));
      setCustomEndDate(formatDateForInput(dateRange.endDate));
    } else {
      setShowCustomInputs(false);
    }
  }, [dateRange]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  // Handle keyboard navigation within dropdown
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  }, []);

  // Toggle dropdown
  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  // Handle preset selection
  const handlePresetSelect = useCallback(
    (preset: DateRangePreset) => {
      if (preset === 'CUSTOM') {
        setShowCustomInputs(true);
        // Don't change the date range yet, wait for custom dates
        return;
      }

      setShowCustomInputs(false);
      setValidationError(null);
      const newRange = getDateRangeFromPreset(preset, timezone);
      onChange(newRange);
      setIsOpen(false);
    },
    [onChange, timezone]
  );

  // Handle custom date change
  const handleCustomStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setCustomStartDate(value);

      const startDate = parseDateFromInput(value);
      const endDate = parseDateFromInput(customEndDate);

      const validation = validateDateRange(startDate, endDate);
      setValidationError(validation.error || null);

      if (validation.valid) {
        onChange({
          startDate,
          endDate,
          preset: 'CUSTOM',
        });
      }
    },
    [customEndDate, onChange]
  );

  const handleCustomEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setCustomEndDate(value);

      const startDate = parseDateFromInput(customStartDate);
      const endDate = parseDateFromInput(value);
      // Set end of day for end date
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
      }

      const validation = validateDateRange(startDate, endDate);
      setValidationError(validation.error || null);

      if (validation.valid) {
        onChange({
          startDate,
          endDate,
          preset: 'CUSTOM',
        });
      }
    },
    [customStartDate, onChange]
  );

  // Apply custom range and close
  const handleApplyCustom = useCallback(() => {
    const startDate = parseDateFromInput(customStartDate);
    const endDate = parseDateFromInput(customEndDate);
    // Set end of day for end date
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    const validation = validateDateRange(startDate, endDate);
    if (!validation.valid) {
      setValidationError(validation.error || null);
      return;
    }

    onChange({
      startDate,
      endDate,
      preset: 'CUSTOM',
    });
    setIsOpen(false);
  }, [customStartDate, customEndDate, onChange]);

  // Clear filters (reset to all time)
  const handleClear = useCallback(() => {
    setShowCustomInputs(false);
    setCustomStartDate('');
    setCustomEndDate('');
    setValidationError(null);
    onChange(DEFAULT_DATE_RANGE);
    setIsOpen(false);
  }, [onChange]);

  const label = getDateRangeLabel(dateRange);
  const hasActiveFilter = isDateRangeActive(dateRange);

  // Group presets for display
  const quickPresets: DateRangePreset[] = ['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS'];
  const periodPresets: DateRangePreset[] = ['THIS_WEEK', 'THIS_MONTH', 'THIS_YEAR'];

  return (
    <div className="relative inline-block" data-testid={testId}>
      {/* Filter button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          inline-flex items-center gap-2 px-3 py-2 rounded-lg
          border border-gray-300 dark:border-gray-600
          bg-white dark:bg-gray-800
          text-sm font-medium text-gray-700 dark:text-gray-300
          hover:bg-gray-50 dark:hover:bg-gray-750
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          dark:focus:ring-offset-gray-900
          transition-colors duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${hasActiveFilter ? 'border-green-500 dark:border-green-400' : ''}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Filter by date range"
        data-testid="alert-date-range-filter-button"
      >
        {/* Calendar icon */}
        <svg
          className={`w-4 h-4 ${hasActiveFilter ? 'text-green-500 dark:text-green-400' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>

        {/* Label */}
        <span data-testid="alert-date-range-filter-label">{label}</span>

        {/* Active indicator */}
        {hasActiveFilter && (
          <span
            className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-green-500"
            data-testid="alert-date-range-filter-active-indicator"
          />
        )}

        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-80 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
          role="listbox"
          aria-label="Date range options"
          onKeyDown={handleKeyDown}
          data-testid="alert-date-range-filter-dropdown"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Date
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-green-600 dark:text-green-400 hover:underline"
                data-testid="alert-date-range-filter-clear"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick presets */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-2">
              Quick Select
            </span>
            <div className="grid grid-cols-2 gap-2">
              {quickPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`
                    flex items-center gap-2 px-3 py-2 text-xs rounded-lg
                    border transition-colors text-left
                    ${
                      dateRange.preset === preset
                        ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900 dark:border-green-400 dark:text-green-200'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }
                  `}
                  role="option"
                  aria-selected={dateRange.preset === preset}
                  data-testid={`alert-date-range-preset-${preset}`}
                >
                  <span>{PRESET_ICONS[preset]}</span>
                  <span>{PRESET_LABELS[preset]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Period presets */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-2">
              Periods
            </span>
            <div className="flex flex-wrap gap-2">
              {/* All Time option */}
              <button
                type="button"
                onClick={() => handlePresetSelect('ALL_TIME')}
                className={`
                  flex items-center gap-1 px-2 py-1 text-xs rounded-full
                  border transition-colors
                  ${
                    dateRange.preset === 'ALL_TIME'
                      ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900 dark:border-green-400 dark:text-green-200'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
                role="option"
                aria-selected={dateRange.preset === 'ALL_TIME'}
                data-testid="alert-date-range-preset-ALL_TIME"
              >
                <span>{PRESET_ICONS.ALL_TIME}</span>
                <span>{PRESET_LABELS.ALL_TIME}</span>
              </button>

              {periodPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`
                    flex items-center gap-1 px-2 py-1 text-xs rounded-full
                    border transition-colors
                    ${
                      dateRange.preset === preset
                        ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900 dark:border-green-400 dark:text-green-200'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }
                  `}
                  role="option"
                  aria-selected={dateRange.preset === preset}
                  data-testid={`alert-date-range-preset-${preset}`}
                >
                  <span>{PRESET_ICONS[preset]}</span>
                  <span>{PRESET_LABELS[preset]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          <div className="px-3 py-2">
            <button
              type="button"
              onClick={() => {
                setShowCustomInputs(!showCustomInputs);
                if (!showCustomInputs) {
                  // Switching to custom mode
                  handlePresetSelect('CUSTOM');
                }
              }}
              className={`
                flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg
                border transition-colors text-left
                ${
                  dateRange.preset === 'CUSTOM' || showCustomInputs
                    ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900 dark:border-green-400 dark:text-green-200'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}
              data-testid="alert-date-range-custom-toggle"
            >
              <span>{PRESET_ICONS.CUSTOM}</span>
              <span>{PRESET_LABELS.CUSTOM}</span>
              <svg
                className={`w-4 h-4 ml-auto transition-transform ${showCustomInputs ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Custom date inputs */}
            {showCustomInputs && (
              <div className="mt-3 space-y-3" data-testid="alert-date-range-custom-inputs">
                {/* Start date */}
                <div>
                  <label
                    htmlFor="custom-start-date"
                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Start Date
                  </label>
                  <input
                    id="custom-start-date"
                    type="date"
                    value={customStartDate}
                    onChange={handleCustomStartChange}
                    max={formatDateForInput(new Date())}
                    className="
                      w-full px-3 py-2 text-sm rounded-lg
                      border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-700
                      text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                    "
                    data-testid="alert-date-range-start-input"
                  />
                </div>

                {/* End date */}
                <div>
                  <label
                    htmlFor="custom-end-date"
                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    End Date
                  </label>
                  <input
                    id="custom-end-date"
                    type="date"
                    value={customEndDate}
                    onChange={handleCustomEndChange}
                    min={customStartDate || undefined}
                    max={formatDateForInput(new Date())}
                    className="
                      w-full px-3 py-2 text-sm rounded-lg
                      border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-700
                      text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                    "
                    data-testid="alert-date-range-end-input"
                  />
                </div>

                {/* Validation error */}
                {validationError && (
                  <p
                    className="text-xs text-red-500 dark:text-red-400"
                    role="alert"
                    data-testid="alert-date-range-error"
                  >
                    {validationError}
                  </p>
                )}

                {/* Apply button */}
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={!!validationError}
                  className={`
                    w-full px-3 py-2 text-sm font-medium rounded-lg
                    transition-colors
                    ${
                      validationError
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }
                  `}
                  data-testid="alert-date-range-apply"
                >
                  Apply Range
                </button>
              </div>
            )}
          </div>

          {/* Selected range summary (when not showing custom inputs) */}
          {hasActiveFilter && !showCustomInputs && dateRange.startDate && dateRange.endDate && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Selected range:</span>{' '}
                {formatDateForDisplay(dateRange.startDate, 'long')} to{' '}
                {formatDateForDisplay(dateRange.endDate, 'long')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Active date range chip component
export interface ActiveDateRangeChipProps {
  dateRange: DateRange;
  onClear: () => void;
  testId?: string;
}

export function ActiveDateRangeChip({
  dateRange,
  onClear,
  testId = 'active-date-range-chip',
}: ActiveDateRangeChipProps) {
  if (!isDateRangeActive(dateRange)) {
    return null;
  }

  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Date:</span>
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
        data-testid="date-range-chip"
      >
        <span>📅</span>
        <span>{getDateRangeLabel(dateRange)}</span>
        <button
          type="button"
          onClick={onClear}
          className="ml-1 hover:opacity-70"
          aria-label="Clear date filter"
          data-testid="date-range-chip-remove"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
        data-testid="clear-date-filter"
      >
        Clear
      </button>
    </div>
  );
}

// Combined filter display including date range
export interface CombinedDateFilterSummaryProps {
  totalAlerts: number;
  filteredAlerts: number;
  hasTypeFilters: boolean;
  hasSeverityFilters: boolean;
  hasDateFilter: boolean;
  onClearAll: () => void;
  testId?: string;
}

export function CombinedDateFilterSummary({
  totalAlerts,
  filteredAlerts,
  hasTypeFilters,
  hasSeverityFilters,
  hasDateFilter,
  onClearAll,
  testId = 'combined-date-filter-summary',
}: CombinedDateFilterSummaryProps) {
  const hasFilters = hasTypeFilters || hasSeverityFilters || hasDateFilter;

  if (!hasFilters) {
    return null;
  }

  const activeFilterCount = [hasTypeFilters, hasSeverityFilters, hasDateFilter].filter(Boolean).length;

  return (
    <div
      className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
      data-testid={testId}
    >
      <span>
        Showing <strong className="text-gray-900 dark:text-white">{filteredAlerts}</strong> of{' '}
        <strong className="text-gray-900 dark:text-white">{totalAlerts}</strong> alerts
        {activeFilterCount > 1 && (
          <span className="text-xs ml-1">({activeFilterCount} filters active)</span>
        )}
      </span>
      <button
        type="button"
        onClick={onClearAll}
        className="text-green-600 dark:text-green-400 hover:underline"
        data-testid="clear-all-date-filters"
      >
        Clear all filters
      </button>
    </div>
  );
}
