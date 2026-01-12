'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// Theme types
export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// Theme configuration
export interface ThemeConfig {
  /** Storage key for persisting theme preference */
  storageKey: string;
  /** Default theme when no preference is set */
  defaultTheme: Theme;
  /** Whether to enable system theme detection */
  enableSystem: boolean;
  /** Attribute to set on document element */
  attribute: 'class' | 'data-theme';
  /** Color scheme meta tag value */
  colorScheme: boolean;
}

// Default configuration
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  storageKey: 'polymarket-tracker-theme',
  defaultTheme: 'system',
  enableSystem: true,
  attribute: 'class',
  colorScheme: true,
};

// Theme context value interface
export interface ThemeContextValue {
  /** Current theme preference (including 'system') */
  theme: Theme;
  /** Resolved theme after applying system preference */
  resolvedTheme: ResolvedTheme;
  /** Set the theme preference */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void;
  /** Whether the current resolved theme is dark */
  isDark: boolean;
  /** Whether the current resolved theme is light */
  isLight: boolean;
  /** Whether theme is being determined from system */
  isSystem: boolean;
  /** System theme preference */
  systemTheme: ResolvedTheme;
  /** Theme configuration */
  config: ThemeConfig;
}

// Create context with undefined default
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Hook to get system theme preference
function useSystemTheme(): ResolvedTheme {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    // Check if window is defined (client-side)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Set initial value
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    // Listen for changes
    const handler = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return systemTheme;
}

// Provider props
export interface ThemeProviderProps {
  children: ReactNode;
  /** Override default configuration */
  config?: Partial<ThemeConfig>;
  /** Initial theme (overrides stored preference) */
  initialTheme?: Theme;
  /** Callback fired when theme changes */
  onThemeChange?: (theme: Theme, resolvedTheme: ResolvedTheme) => void;
}

/**
 * ThemeProvider - Provides theme context to the application
 *
 * Features:
 * - Light, dark, and system theme options
 * - Persists preference to localStorage
 * - Listens for system theme changes
 * - Applies theme class to document element
 * - Updates color-scheme meta tag
 */
export function ThemeProvider({
  children,
  config: configOverride,
  initialTheme,
  onThemeChange,
}: ThemeProviderProps) {
  // Merge config with defaults
  const config: ThemeConfig = { ...DEFAULT_THEME_CONFIG, ...configOverride };

  // Get system theme
  const systemTheme = useSystemTheme();

  // Theme state
  const [theme, setThemeState] = useState<Theme>(() => {
    // Use initial theme if provided
    if (initialTheme) return initialTheme;

    // Otherwise use default (will be updated from storage in useEffect)
    return config.defaultTheme;
  });

  // Load theme from storage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialTheme) return; // Don't override if initial theme provided

    try {
      const stored = localStorage.getItem(config.storageKey);
      if (stored && (stored === 'light' || stored === 'dark' || stored === 'system')) {
        setThemeState(stored as Theme);
      }
    } catch {
      // localStorage not available, use default
    }
  }, [config.storageKey, initialTheme]);

  // Resolve theme (handle system preference)
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  // Apply theme to document
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Apply class-based theme
    if (config.attribute === 'class') {
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    } else {
      // Apply data attribute theme
      root.setAttribute('data-theme', resolvedTheme);
    }

    // Update color-scheme meta
    if (config.colorScheme) {
      root.style.colorScheme = resolvedTheme;
    }
  }, [resolvedTheme, config.attribute, config.colorScheme]);

  // Set theme function
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);

    // Persist to storage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(config.storageKey, newTheme);
      } catch {
        // localStorage not available
      }
    }

    // Fire callback
    const resolved = newTheme === 'system' ? systemTheme : newTheme;
    onThemeChange?.(newTheme, resolved);
  }, [config.storageKey, systemTheme, onThemeChange]);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // Context value
  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isSystem: theme === 'system',
    systemTheme,
    config,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme - Hook to access theme context
 *
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}

/**
 * useThemeSafe - Hook that returns null if used outside provider
 *
 * Useful for components that may be rendered outside the provider
 */
export function useThemeSafe(): ThemeContextValue | null {
  return useContext(ThemeContext) ?? null;
}

// Theme option for UI display
export interface ThemeOption {
  value: Theme;
  label: string;
  icon: string;
  description: string;
}

// Theme options for toggle/selector
export const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    icon: '☀️',
    description: 'Light mode with bright colors',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: '🌙',
    description: 'Dark mode for low-light environments',
  },
  {
    value: 'system',
    label: 'System',
    icon: '💻',
    description: 'Follow system preference',
  },
];

/**
 * getThemeOption - Get theme option by value
 */
export function getThemeOption(theme: Theme): ThemeOption | undefined {
  return THEME_OPTIONS.find((opt) => opt.value === theme);
}

/**
 * getResolvedThemeIcon - Get icon for resolved theme
 */
export function getResolvedThemeIcon(resolvedTheme: ResolvedTheme): string {
  return resolvedTheme === 'dark' ? '🌙' : '☀️';
}

// Export context for advanced use cases
export { ThemeContext };
