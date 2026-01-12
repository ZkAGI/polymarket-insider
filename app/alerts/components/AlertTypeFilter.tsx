'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  AlertType,
  getAlertTypeIcon,
  getAlertTypeLabel,
} from '../../dashboard/components/AlertFeed';

// All available alert types
export const ALL_ALERT_TYPES: AlertType[] = [
  'WHALE_TRADE',
  'PRICE_MOVEMENT',
  'INSIDER_ACTIVITY',
  'FRESH_WALLET',
  'WALLET_REACTIVATION',
  'COORDINATED_ACTIVITY',
  'UNUSUAL_PATTERN',
  'MARKET_RESOLVED',
  'NEW_MARKET',
  'SUSPICIOUS_FUNDING',
  'SANCTIONED_ACTIVITY',
  'SYSTEM',
];

// Alert type categories for grouping in dropdown
export type AlertTypeCategory = 'TRADING' | 'WALLET' | 'MARKET' | 'SYSTEM';

export const ALERT_TYPE_CATEGORIES: Record<AlertTypeCategory, AlertType[]> = {
  TRADING: ['WHALE_TRADE', 'PRICE_MOVEMENT', 'INSIDER_ACTIVITY', 'COORDINATED_ACTIVITY'],
  WALLET: ['FRESH_WALLET', 'WALLET_REACTIVATION', 'SUSPICIOUS_FUNDING', 'SANCTIONED_ACTIVITY'],
  MARKET: ['UNUSUAL_PATTERN', 'MARKET_RESOLVED', 'NEW_MARKET'],
  SYSTEM: ['SYSTEM'],
};

export const CATEGORY_LABELS: Record<AlertTypeCategory, string> = {
  TRADING: 'Trading Activity',
  WALLET: 'Wallet Activity',
  MARKET: 'Market Events',
  SYSTEM: 'System',
};

export const CATEGORY_ICONS: Record<AlertTypeCategory, string> = {
  TRADING: '💹',
  WALLET: '👛',
  MARKET: '📊',
  SYSTEM: '⚙️',
};

export interface AlertTypeFilterProps {
  selectedTypes: AlertType[];
  onChange: (types: AlertType[]) => void;
  disabled?: boolean;
  testId?: string;
}

// Helper to get category for a type
export function getTypeCategory(type: AlertType): AlertTypeCategory {
  for (const [category, types] of Object.entries(ALERT_TYPE_CATEGORIES)) {
    if (types.includes(type)) {
      return category as AlertTypeCategory;
    }
  }
  return 'SYSTEM';
}

// Helper to check if all types are selected
export function areAllTypesSelected(selectedTypes: AlertType[]): boolean {
  return selectedTypes.length === ALL_ALERT_TYPES.length;
}

// Helper to check if no types are selected
export function areNoTypesSelected(selectedTypes: AlertType[]): boolean {
  return selectedTypes.length === 0;
}

// Helper to check if all types in a category are selected
export function areCategoryTypesSelected(
  selectedTypes: AlertType[],
  category: AlertTypeCategory
): boolean {
  const categoryTypes = ALERT_TYPE_CATEGORIES[category];
  return categoryTypes.every((type) => selectedTypes.includes(type));
}

// Helper to check if some (but not all) types in a category are selected
export function areSomeCategoryTypesSelected(
  selectedTypes: AlertType[],
  category: AlertTypeCategory
): boolean {
  const categoryTypes = ALERT_TYPE_CATEGORIES[category];
  const selectedInCategory = categoryTypes.filter((type) => selectedTypes.includes(type));
  return selectedInCategory.length > 0 && selectedInCategory.length < categoryTypes.length;
}

// Get display text for selected types
export function getSelectedTypesLabel(selectedTypes: AlertType[]): string {
  if (areAllTypesSelected(selectedTypes) || areNoTypesSelected(selectedTypes)) {
    return 'All Types';
  }

  if (selectedTypes.length === 1 && selectedTypes[0] !== undefined) {
    return getAlertTypeLabel(selectedTypes[0]);
  }

  // Check if entire categories are selected
  const categories = Object.keys(ALERT_TYPE_CATEGORIES) as AlertTypeCategory[];
  const fullySelectedCategories = categories.filter((cat) =>
    areCategoryTypesSelected(selectedTypes, cat)
  );

  const firstCategory = fullySelectedCategories[0];
  if (fullySelectedCategories.length === 1 && firstCategory !== undefined) {
    const remainingTypes = selectedTypes.filter(
      (type) => !ALERT_TYPE_CATEGORIES[firstCategory].includes(type)
    );
    if (remainingTypes.length === 0) {
      return CATEGORY_LABELS[firstCategory];
    }
  }

  return `${selectedTypes.length} types`;
}

// Main AlertTypeFilter component
export default function AlertTypeFilter({
  selectedTypes,
  onChange,
  disabled = false,
  testId = 'alert-type-filter',
}: AlertTypeFilterProps) {
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

  // Handle keyboard navigation
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

  // Toggle single type
  const handleTypeToggle = useCallback(
    (type: AlertType) => {
      const isSelected = selectedTypes.includes(type);
      let newTypes: AlertType[];

      if (isSelected) {
        // Remove type
        newTypes = selectedTypes.filter((t) => t !== type);
      } else {
        // Add type
        newTypes = [...selectedTypes, type];
      }

      onChange(newTypes);
    },
    [selectedTypes, onChange]
  );

  // Toggle entire category
  const handleCategoryToggle = useCallback(
    (category: AlertTypeCategory) => {
      const categoryTypes = ALERT_TYPE_CATEGORIES[category];
      const allSelected = areCategoryTypesSelected(selectedTypes, category);

      let newTypes: AlertType[];

      if (allSelected) {
        // Remove all types from this category
        newTypes = selectedTypes.filter((type) => !categoryTypes.includes(type));
      } else {
        // Add all types from this category
        const typesToAdd = categoryTypes.filter((type) => !selectedTypes.includes(type));
        newTypes = [...selectedTypes, ...typesToAdd];
      }

      onChange(newTypes);
    },
    [selectedTypes, onChange]
  );

  // Select all types
  const handleSelectAll = useCallback(() => {
    onChange([...ALL_ALERT_TYPES]);
  }, [onChange]);

  // Clear all selections
  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const label = getSelectedTypesLabel(selectedTypes);
  const hasActiveFilters = !areAllTypesSelected(selectedTypes) && !areNoTypesSelected(selectedTypes);

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
          ${hasActiveFilters ? 'border-blue-500 dark:border-blue-400' : ''}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Filter by alert type"
        data-testid="alert-type-filter-button"
      >
        {/* Filter icon */}
        <svg
          className={`w-4 h-4 ${hasActiveFilters ? 'text-blue-500 dark:text-blue-400' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>

        {/* Label */}
        <span data-testid="alert-type-filter-label">{label}</span>

        {/* Active filter count badge */}
        {hasActiveFilters && (
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full bg-blue-500 text-white"
            data-testid="alert-type-filter-badge"
          >
            {selectedTypes.length}
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
          aria-label="Alert types"
          onKeyDown={handleKeyDown}
          data-testid="alert-type-filter-dropdown"
        >
          {/* Header with actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by Type
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                data-testid="alert-type-filter-select-all"
              >
                Select All
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                data-testid="alert-type-filter-clear-all"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Categories and types */}
          <div className="max-h-80 overflow-y-auto" data-testid="alert-type-filter-list">
            {(Object.keys(ALERT_TYPE_CATEGORIES) as AlertTypeCategory[]).map((category) => {
              const categoryTypes = ALERT_TYPE_CATEGORIES[category];
              const allCategorySelected = areCategoryTypesSelected(selectedTypes, category);
              const someCategorySelected = areSomeCategoryTypesSelected(selectedTypes, category);

              return (
                <div key={category} data-testid={`alert-type-filter-category-${category}`}>
                  {/* Category header */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900"
                    onClick={() => handleCategoryToggle(category)}
                    role="option"
                    aria-selected={allCategorySelected}
                    data-testid={`alert-type-filter-category-toggle-${category}`}
                  >
                    {/* Checkbox */}
                    <span
                      className={`
                        inline-flex items-center justify-center w-4 h-4 border rounded
                        ${
                          allCategorySelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : someCategorySelected
                            ? 'bg-blue-100 border-blue-500 dark:bg-blue-900'
                            : 'border-gray-300 dark:border-gray-600'
                        }
                      `}
                      data-testid={`alert-type-filter-category-checkbox-${category}`}
                    >
                      {allCategorySelected && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {someCategorySelected && !allCategorySelected && (
                        <span className="w-2 h-2 bg-blue-500 rounded-sm" />
                      )}
                    </span>

                    {/* Category icon and label */}
                    <span className="text-base">{CATEGORY_ICONS[category]}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                      {categoryTypes.filter((t) => selectedTypes.includes(t)).length}/
                      {categoryTypes.length}
                    </span>
                  </div>

                  {/* Type items */}
                  <div className="py-1">
                    {categoryTypes.map((type) => {
                      const isSelected = selectedTypes.includes(type);

                      return (
                        <div
                          key={type}
                          className="flex items-center gap-2 px-3 py-1.5 pl-8 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
                          onClick={() => handleTypeToggle(type)}
                          role="option"
                          aria-selected={isSelected}
                          data-testid={`alert-type-filter-option-${type}`}
                        >
                          {/* Checkbox */}
                          <span
                            className={`
                              inline-flex items-center justify-center w-4 h-4 border rounded
                              ${
                                isSelected
                                  ? 'bg-blue-500 border-blue-500 text-white'
                                  : 'border-gray-300 dark:border-gray-600'
                              }
                            `}
                            data-testid={`alert-type-filter-checkbox-${type}`}
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

                          {/* Type icon and label */}
                          <span className="text-base">{getAlertTypeIcon(type)}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {getAlertTypeLabel(type)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer with active filters summary */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedTypes.length} of {ALL_ALERT_TYPES.length} types selected
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                data-testid="alert-type-filter-apply"
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

// ActiveFilterChips component to display selected types as removable chips
export interface ActiveFilterChipsProps {
  selectedTypes: AlertType[];
  onRemove: (type: AlertType) => void;
  onClearAll: () => void;
  testId?: string;
}

export function ActiveFilterChips({
  selectedTypes,
  onRemove,
  onClearAll,
  testId = 'active-filter-chips',
}: ActiveFilterChipsProps) {
  // Don't show if all or no types are selected
  if (areAllTypesSelected(selectedTypes) || areNoTypesSelected(selectedTypes)) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 mt-3"
      data-testid={testId}
    >
      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Active filters:</span>

      {selectedTypes.map((type) => (
        <span
          key={type}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          data-testid={`filter-chip-${type}`}
        >
          <span>{getAlertTypeIcon(type)}</span>
          <span>{getAlertTypeLabel(type)}</span>
          <button
            type="button"
            onClick={() => onRemove(type)}
            className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
            aria-label={`Remove ${getAlertTypeLabel(type)} filter`}
            data-testid={`filter-chip-remove-${type}`}
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
        data-testid="clear-all-filters"
      >
        Clear all
      </button>
    </div>
  );
}
