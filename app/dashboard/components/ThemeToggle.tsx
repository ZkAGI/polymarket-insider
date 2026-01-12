'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import {
  useThemeSafe,
  Theme,
  THEME_OPTIONS,
  getResolvedThemeIcon,
} from '../../contexts/ThemeContext';

// Theme toggle mode
export type ThemeToggleMode = 'icon' | 'button' | 'dropdown';

// Theme toggle size
export type ThemeToggleSize = 'sm' | 'md' | 'lg';

// Size configurations
const SIZE_CONFIG = {
  sm: {
    button: 'w-8 h-8 text-sm',
    icon: 'text-base',
    dropdown: 'text-xs',
    dropdownWidth: 'w-36',
  },
  md: {
    button: 'w-10 h-10 text-base',
    icon: 'text-lg',
    dropdown: 'text-sm',
    dropdownWidth: 'w-44',
  },
  lg: {
    button: 'w-12 h-12 text-lg',
    icon: 'text-xl',
    dropdown: 'text-base',
    dropdownWidth: 'w-52',
  },
};

export interface ThemeToggleProps {
  /** Toggle mode: icon (simple toggle), button (labeled), or dropdown (full options) */
  mode?: ThemeToggleMode;
  /** Size of the toggle */
  size?: ThemeToggleSize;
  /** Whether to show the current theme label */
  showLabel?: boolean;
  /** Whether to show system option in dropdown */
  showSystemOption?: boolean;
  /** Custom class name */
  className?: string;
  /** Test ID for testing */
  testId?: string;
  /** Callback fired when theme changes */
  onThemeChange?: (theme: Theme) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Position of dropdown */
  dropdownPosition?: 'left' | 'right';
}

/**
 * ThemeToggle - Component to toggle between light, dark, and system themes
 *
 * Modes:
 * - icon: Simple icon button that toggles between light/dark
 * - button: Labeled button that toggles between light/dark
 * - dropdown: Full dropdown with all theme options including system
 *
 * Features:
 * - Keyboard navigation (Tab, Enter, Space, Escape, Arrow keys)
 * - Full accessibility (aria-label, aria-expanded, role)
 * - Animated transitions
 * - Responsive sizing
 * - Click outside to close dropdown
 */
export default function ThemeToggle({
  mode = 'dropdown',
  size = 'md',
  showLabel = false,
  showSystemOption = true,
  className = '',
  testId = 'theme-toggle',
  onThemeChange,
  disabled = false,
  tooltip,
  dropdownPosition = 'right',
}: ThemeToggleProps) {
  // Get theme context (may be null if outside provider)
  const themeContext = useThemeSafe();

  // Dropdown state
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get size config
  const sizeConfig = SIZE_CONFIG[size];

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle escape key to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Handle theme selection
  const handleThemeSelect = useCallback(
    (theme: Theme) => {
      if (themeContext) {
        themeContext.setTheme(theme);
        onThemeChange?.(theme);
      }
      setIsOpen(false);
    },
    [themeContext, onThemeChange]
  );

  // Handle toggle (for icon/button modes)
  const handleToggle = useCallback(() => {
    if (themeContext) {
      themeContext.toggleTheme();
      onThemeChange?.(themeContext.resolvedTheme === 'dark' ? 'light' : 'dark');
    }
  }, [themeContext, onThemeChange]);

  // Handle button click based on mode
  const handleButtonClick = useCallback(() => {
    if (disabled) return;

    if (mode === 'dropdown') {
      setIsOpen((prev) => !prev);
    } else {
      handleToggle();
    }
  }, [mode, disabled, handleToggle]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleButtonClick();
      } else if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      } else if (mode === 'dropdown' && isOpen) {
        // Arrow key navigation in dropdown
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const options = showSystemOption
            ? THEME_OPTIONS
            : THEME_OPTIONS.filter((o) => o.value !== 'system');
          const currentIndex = options.findIndex(
            (o) => o.value === themeContext?.theme
          );
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          const nextIndex =
            (currentIndex + direction + options.length) % options.length;
          const nextOption = options[nextIndex];
          if (nextOption) {
            handleThemeSelect(nextOption.value);
          }
        }
      }
    },
    [
      disabled,
      handleButtonClick,
      isOpen,
      mode,
      showSystemOption,
      themeContext?.theme,
      handleThemeSelect,
    ]
  );

  // Handle dropdown item keyboard navigation
  const handleItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, theme: Theme) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleThemeSelect(theme);
      }
    },
    [handleThemeSelect]
  );

  // If no theme context, render a disabled placeholder
  if (!themeContext) {
    return (
      <div
        ref={containerRef}
        className={`relative inline-flex ${className}`}
        data-testid={testId}
      >
        <button
          type="button"
          className={`
            ${sizeConfig.button}
            inline-flex items-center justify-center
            rounded-lg
            bg-gray-100 dark:bg-gray-700
            text-gray-400 dark:text-gray-500
            cursor-not-allowed
            transition-colors
          `}
          disabled
          aria-label="Theme toggle unavailable"
        >
          <span className={sizeConfig.icon}>🌓</span>
        </button>
      </div>
    );
  }

  const { theme, resolvedTheme, isDark } = themeContext;
  const currentIcon = getResolvedThemeIcon(resolvedTheme);
  const currentLabel = THEME_OPTIONS.find((o) => o.value === theme)?.label || 'Theme';

  // Get dropdown options
  const dropdownOptions = showSystemOption
    ? THEME_OPTIONS
    : THEME_OPTIONS.filter((o) => o.value !== 'system');

  // Render icon-only toggle
  if (mode === 'icon') {
    return (
      <div
        ref={containerRef}
        className={`relative inline-flex ${className}`}
        data-testid={testId}
      >
        <button
          type="button"
          onClick={handleButtonClick}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            ${sizeConfig.button}
            inline-flex items-center justify-center
            rounded-lg
            bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
            text-gray-700 dark:text-gray-200
            border border-gray-200 dark:border-gray-600
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            dark:focus:ring-offset-gray-800
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-label={`Toggle theme (currently ${resolvedTheme})`}
          title={tooltip || `Switch to ${isDark ? 'light' : 'dark'} mode`}
          data-testid={`${testId}-button`}
        >
          <span
            className={`${sizeConfig.icon} transition-transform duration-300 ${
              isDark ? 'rotate-0' : 'rotate-180'
            }`}
          >
            {currentIcon}
          </span>
        </button>
      </div>
    );
  }

  // Render button with label
  if (mode === 'button') {
    return (
      <div
        ref={containerRef}
        className={`relative inline-flex ${className}`}
        data-testid={testId}
      >
        <button
          type="button"
          onClick={handleButtonClick}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            inline-flex items-center gap-2 px-3 py-2
            rounded-lg
            bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
            text-gray-700 dark:text-gray-200
            border border-gray-200 dark:border-gray-600
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            dark:focus:ring-offset-gray-800
            ${sizeConfig.dropdown}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-label={`Toggle theme (currently ${resolvedTheme})`}
          title={tooltip || `Switch to ${isDark ? 'light' : 'dark'} mode`}
          data-testid={`${testId}-button`}
        >
          <span className={sizeConfig.icon}>{currentIcon}</span>
          {showLabel && <span>{isDark ? 'Dark' : 'Light'}</span>}
        </button>
      </div>
    );
  }

  // Render dropdown (default)
  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${className}`}
      data-testid={testId}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleButtonClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          inline-flex items-center gap-2 px-3 py-2
          rounded-lg
          bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
          text-gray-700 dark:text-gray-200
          border border-gray-200 dark:border-gray-600
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          dark:focus:ring-offset-gray-800
          ${sizeConfig.dropdown}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={`Theme selector (currently ${currentLabel})`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={tooltip || 'Select theme'}
        data-testid={`${testId}-button`}
      >
        <span className={sizeConfig.icon}>{currentIcon}</span>
        {showLabel && <span>{currentLabel}</span>}
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Theme options"
          className={`
            absolute top-full mt-1 z-50
            ${dropdownPosition === 'right' ? 'right-0' : 'left-0'}
            ${sizeConfig.dropdownWidth}
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-lg shadow-lg
            py-1
            animate-in fade-in slide-in-from-top-2 duration-200
          `}
          data-testid={`${testId}-dropdown`}
        >
          {dropdownOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={theme === option.value}
              onClick={() => handleThemeSelect(option.value)}
              onKeyDown={(e) => handleItemKeyDown(e, option.value)}
              className={`
                w-full px-3 py-2
                flex items-center gap-3
                text-left
                transition-colors duration-150
                ${sizeConfig.dropdown}
                ${
                  theme === option.value
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
              data-testid={`${testId}-option-${option.value}`}
            >
              <span className={sizeConfig.icon}>{option.icon}</span>
              <div className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {option.description}
                </span>
              </div>
              {theme === option.value && (
                <svg
                  className="w-4 h-4 ml-auto text-blue-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ThemeToggleIcon - Simple icon-only theme toggle
 */
export function ThemeToggleIcon(props: Omit<ThemeToggleProps, 'mode'>) {
  return <ThemeToggle {...props} mode="icon" />;
}

/**
 * ThemeToggleButton - Button with optional label
 */
export function ThemeToggleButton(props: Omit<ThemeToggleProps, 'mode'>) {
  return <ThemeToggle {...props} mode="button" />;
}

/**
 * ThemeToggleDropdown - Full dropdown with all options
 */
export function ThemeToggleDropdown(props: Omit<ThemeToggleProps, 'mode'>) {
  return <ThemeToggle {...props} mode="dropdown" />;
}

// Export helper for generating mock theme state (useful for testing)
export function generateMockThemeState(): {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  isDark: boolean;
} {
  const themes: Theme[] = ['light', 'dark', 'system'];
  const theme = themes[Math.floor(Math.random() * themes.length)]!;
  const resolvedTheme: 'light' | 'dark' = theme === 'system'
    ? Math.random() > 0.5 ? 'dark' : 'light'
    : theme;

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
  };
}
