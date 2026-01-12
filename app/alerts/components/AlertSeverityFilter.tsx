'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  AlertSeverity,
  getSeverityColor,
} from '../../dashboard/components/AlertFeed';

// All available severity levels in order from most to least severe
export const ALL_SEVERITY_LEVELS: AlertSeverity[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
];

// Severity icons
export const SEVERITY_ICONS: Record<AlertSeverity, string> = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🟢',
  INFO: '🔵',
};

// Severity labels (human-readable)
export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info',
};

// Severity descriptions for tooltips/accessibility
export const SEVERITY_DESCRIPTIONS: Record<AlertSeverity, string> = {
  CRITICAL: 'Requires immediate attention - potential insider trading or major anomaly detected',
  HIGH: 'Important alert requiring prompt review - significant suspicious activity',
  MEDIUM: 'Moderate priority - unusual patterns that warrant monitoring',
  LOW: 'Low priority - minor anomalies or informational',
  INFO: 'Informational only - system notifications and status updates',
};

export interface AlertSeverityFilterProps {
  selectedSeverities: AlertSeverity[];
  onChange: (severities: AlertSeverity[]) => void;
  disabled?: boolean;
  testId?: string;
}

// Helper to check if all severities are selected
export function areAllSeveritiesSelected(selectedSeverities: AlertSeverity[]): boolean {
  return selectedSeverities.length === ALL_SEVERITY_LEVELS.length;
}

// Helper to check if no severities are selected
export function areNoSeveritiesSelected(selectedSeverities: AlertSeverity[]): boolean {
  return selectedSeverities.length === 0;
}

// Helper to check if at least critical/high are selected (useful shortcut)
export function areCriticalHighSelected(selectedSeverities: AlertSeverity[]): boolean {
  return selectedSeverities.includes('CRITICAL') && selectedSeverities.includes('HIGH');
}

// Get display text for selected severities
export function getSelectedSeveritiesLabel(selectedSeverities: AlertSeverity[]): string {
  if (areAllSeveritiesSelected(selectedSeverities) || areNoSeveritiesSelected(selectedSeverities)) {
    return 'All Severities';
  }

  if (selectedSeverities.length === 1 && selectedSeverities[0] !== undefined) {
    return SEVERITY_LABELS[selectedSeverities[0]];
  }

  // Check for common presets
  const hasCritical = selectedSeverities.includes('CRITICAL');
  const hasHigh = selectedSeverities.includes('HIGH');
  const hasMedium = selectedSeverities.includes('MEDIUM');
  const hasLow = selectedSeverities.includes('LOW');
  const hasInfo = selectedSeverities.includes('INFO');

  // Critical + High only
  if (hasCritical && hasHigh && !hasMedium && !hasLow && !hasInfo) {
    return 'Critical & High';
  }

  // Critical + High + Medium only
  if (hasCritical && hasHigh && hasMedium && !hasLow && !hasInfo) {
    return 'Medium and above';
  }

  return `${selectedSeverities.length} levels`;
}

// Get severity rank (for sorting)
export function getSeverityRank(severity: AlertSeverity): number {
  const ranks: Record<AlertSeverity, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFO: 1,
  };
  return ranks[severity];
}

// Sort severities by rank (highest first)
export function sortSeverities(severities: AlertSeverity[]): AlertSeverity[] {
  return [...severities].sort((a, b) => getSeverityRank(b) - getSeverityRank(a));
}

// Main AlertSeverityFilter component
export default function AlertSeverityFilter({
  selectedSeverities,
  onChange,
  disabled = false,
  testId = 'alert-severity-filter',
}: AlertSeverityFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    },
    []
  );

  // Toggle dropdown
  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  // Toggle single severity
  const handleSeverityToggle = useCallback(
    (severity: AlertSeverity) => {
      const isSelected = selectedSeverities.includes(severity);
      let newSeverities: AlertSeverity[];

      if (isSelected) {
        // Remove severity
        newSeverities = selectedSeverities.filter((s) => s !== severity);
      } else {
        // Add severity
        newSeverities = [...selectedSeverities, severity];
      }

      onChange(newSeverities);
    },
    [selectedSeverities, onChange]
  );

  // Select all severities
  const handleSelectAll = useCallback(() => {
    onChange([...ALL_SEVERITY_LEVELS]);
  }, [onChange]);

  // Clear all selections
  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // Quick select: Critical & High only
  const handleSelectCriticalHigh = useCallback(() => {
    onChange(['CRITICAL', 'HIGH']);
  }, [onChange]);

  // Quick select: Medium and above
  const handleSelectMediumAbove = useCallback(() => {
    onChange(['CRITICAL', 'HIGH', 'MEDIUM']);
  }, [onChange]);

  const label = getSelectedSeveritiesLabel(selectedSeverities);
  const hasActiveFilters = !areAllSeveritiesSelected(selectedSeverities) && !areNoSeveritiesSelected(selectedSeverities);

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
          ${hasActiveFilters ? 'border-purple-500 dark:border-purple-400' : ''}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Filter by severity"
        data-testid="alert-severity-filter-button"
      >
        {/* Severity indicator icon */}
        <svg
          className={`w-4 h-4 ${hasActiveFilters ? 'text-purple-500 dark:text-purple-400' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>

        {/* Label */}
        <span data-testid="alert-severity-filter-label">{label}</span>

        {/* Active filter count badge */}
        {hasActiveFilters && (
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full bg-purple-500 text-white"
            data-testid="alert-severity-filter-badge"
          >
            {selectedSeverities.length}
          </span>
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
          className="absolute z-50 mt-2 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
          role="listbox"
          aria-label="Severity levels"
          onKeyDown={handleKeyDown}
          data-testid="alert-severity-filter-dropdown"
        >
          {/* Header with actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Severity
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                data-testid="alert-severity-filter-select-all"
              >
                Select All
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                data-testid="alert-severity-filter-clear-all"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-2">
              Quick Select:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectCriticalHigh}
                className={`
                  text-xs px-2 py-1 rounded-full border transition-colors
                  ${
                    areCriticalHighSelected(selectedSeverities) &&
                    selectedSeverities.length === 2
                      ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900 dark:border-purple-400 dark:text-purple-200'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                data-testid="alert-severity-filter-preset-critical-high"
              >
                Critical & High
              </button>
              <button
                type="button"
                onClick={handleSelectMediumAbove}
                className={`
                  text-xs px-2 py-1 rounded-full border transition-colors
                  ${
                    selectedSeverities.includes('CRITICAL') &&
                    selectedSeverities.includes('HIGH') &&
                    selectedSeverities.includes('MEDIUM') &&
                    selectedSeverities.length === 3
                      ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900 dark:border-purple-400 dark:text-purple-200'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                data-testid="alert-severity-filter-preset-medium-above"
              >
                Medium & Above
              </button>
            </div>
          </div>

          {/* Severity options */}
          <div className="py-2" data-testid="alert-severity-filter-list">
            {ALL_SEVERITY_LEVELS.map((severity) => {
              const isSelected = selectedSeverities.includes(severity);

              return (
                <div
                  key={severity}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
                  onClick={() => handleSeverityToggle(severity)}
                  role="option"
                  aria-selected={isSelected}
                  data-testid={`alert-severity-filter-option-${severity}`}
                >
                  {/* Checkbox */}
                  <span
                    className={`
                      inline-flex items-center justify-center w-4 h-4 border rounded
                      ${
                        isSelected
                          ? 'bg-purple-500 border-purple-500 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      }
                    `}
                    data-testid={`alert-severity-filter-checkbox-${severity}`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </span>

                  {/* Severity icon */}
                  <span className="text-base" data-testid={`alert-severity-filter-icon-${severity}`}>
                    {SEVERITY_ICONS[severity]}
                  </span>

                  {/* Severity label and badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {SEVERITY_LABELS[severity]}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${getSeverityColor(severity)}`}
                      >
                        {severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                      {SEVERITY_DESCRIPTIONS[severity]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer with active filters summary */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedSeverities.length} of {ALL_SEVERITY_LEVELS.length} levels selected
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs px-2 py-1 rounded bg-purple-500 text-white hover:bg-purple-600 transition-colors"
                data-testid="alert-severity-filter-apply"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ActiveSeverityChips component to display selected severities as removable chips
export interface ActiveSeverityChipsProps {
  selectedSeverities: AlertSeverity[];
  onRemove: (severity: AlertSeverity) => void;
  onClearAll: () => void;
  testId?: string;
}

export function ActiveSeverityChips({
  selectedSeverities,
  onRemove,
  onClearAll,
  testId = 'active-severity-chips',
}: ActiveSeverityChipsProps) {
  // Don't show if all or no severities are selected
  if (areAllSeveritiesSelected(selectedSeverities) || areNoSeveritiesSelected(selectedSeverities)) {
    return null;
  }

  // Sort severities by rank for display
  const sortedSeverities = sortSeverities(selectedSeverities);

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={testId}
    >
      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Severity:</span>

      {sortedSeverities.map((severity) => (
        <span
          key={severity}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getSeverityColor(severity)}`}
          data-testid={`severity-chip-${severity}`}
        >
          <span>{SEVERITY_ICONS[severity]}</span>
          <span>{SEVERITY_LABELS[severity]}</span>
          <button
            type="button"
            onClick={() => onRemove(severity)}
            className="ml-1 hover:opacity-70"
            aria-label={`Remove ${SEVERITY_LABELS[severity]} filter`}
            data-testid={`severity-chip-remove-${severity}`}
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
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
        data-testid="clear-severity-filters"
      >
        Clear
      </button>
    </div>
  );
}

// Combined filter display showing both type and severity active filters
export interface CombinedFilterSummaryProps {
  totalAlerts: number;
  filteredAlerts: number;
  hasTypeFilters: boolean;
  hasSeverityFilters: boolean;
  onClearAll: () => void;
  testId?: string;
}

export function CombinedFilterSummary({
  totalAlerts,
  filteredAlerts,
  hasTypeFilters,
  hasSeverityFilters,
  onClearAll,
  testId = 'combined-filter-summary',
}: CombinedFilterSummaryProps) {
  const hasFilters = hasTypeFilters || hasSeverityFilters;

  if (!hasFilters) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
      data-testid={testId}
    >
      <span>
        Showing <strong className="text-gray-900 dark:text-white">{filteredAlerts}</strong> of{' '}
        <strong className="text-gray-900 dark:text-white">{totalAlerts}</strong> alerts
      </span>
      <button
        type="button"
        onClick={onClearAll}
        className="text-purple-600 dark:text-purple-400 hover:underline"
        data-testid="clear-all-combined-filters"
      >
        Clear all filters
      </button>
    </div>
  );
}
