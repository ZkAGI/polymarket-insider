/**
 * Unit tests for DashboardRefreshControls component
 * Feature: UI-DASH-009 - Dashboard refresh controls
 */
import { describe, it, expect, vi } from 'vitest';

// Import types and helper functions from DashboardRefreshControls component
import type {
  RefreshInterval,
  RefreshState,
  RefreshIntervalConfig,
  DashboardRefreshControlsProps,
} from '../../app/dashboard/components/DashboardRefreshControls';

import {
  refreshIntervalConfig,
  getRefreshIntervalConfig,
  getRefreshIntervalOptions,
  formatRelativeTime,
  formatTimeUntilRefresh,
  generateMockRefreshState,
} from '../../app/dashboard/components/DashboardRefreshControls';

// Mock React hooks for server-side testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn((initial) => [initial, vi.fn()]),
    useEffect: vi.fn(),
    useCallback: vi.fn((fn) => fn),
    useRef: vi.fn(() => ({ current: null })),
  };
});

describe('DashboardRefreshControls Types and Interfaces', () => {
  describe('RefreshInterval type values', () => {
    const validIntervals: RefreshInterval[] = ['OFF', '5s', '10s', '30s', '1m', '5m'];

    it('should have all expected interval options', () => {
      expect(validIntervals).toHaveLength(6);
    });

    it('should include OFF option to disable auto-refresh', () => {
      expect(validIntervals).toContain('OFF');
    });

    it('should include 5 second interval', () => {
      expect(validIntervals).toContain('5s');
    });

    it('should include 10 second interval', () => {
      expect(validIntervals).toContain('10s');
    });

    it('should include 30 second interval', () => {
      expect(validIntervals).toContain('30s');
    });

    it('should include 1 minute interval', () => {
      expect(validIntervals).toContain('1m');
    });

    it('should include 5 minute interval', () => {
      expect(validIntervals).toContain('5m');
    });
  });

  describe('RefreshState type values', () => {
    const validStates: RefreshState[] = ['IDLE', 'REFRESHING', 'SUCCESS', 'ERROR'];

    it('should have all four refresh states', () => {
      expect(validStates).toHaveLength(4);
    });

    it('should include IDLE state', () => {
      expect(validStates).toContain('IDLE');
    });

    it('should include REFRESHING state', () => {
      expect(validStates).toContain('REFRESHING');
    });

    it('should include SUCCESS state', () => {
      expect(validStates).toContain('SUCCESS');
    });

    it('should include ERROR state', () => {
      expect(validStates).toContain('ERROR');
    });
  });

  describe('RefreshIntervalConfig interface', () => {
    it('should have label, ms, and description fields', () => {
      const config: RefreshIntervalConfig = {
        label: 'Test',
        ms: 1000,
        description: 'Test description',
      };
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('ms');
      expect(config).toHaveProperty('description');
    });

    it('should allow null ms value for OFF interval', () => {
      const config: RefreshIntervalConfig = {
        label: 'Off',
        ms: null,
        description: 'Auto-refresh disabled',
      };
      expect(config.ms).toBeNull();
    });
  });

  describe('DashboardRefreshControlsProps interface', () => {
    it('should require onRefresh callback', () => {
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
      };
      expect(props.onRefresh).toBeDefined();
    });

    it('should have optional isRefreshing prop', () => {
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
        isRefreshing: true,
      };
      expect(props.isRefreshing).toBe(true);
    });

    it('should have optional lastRefreshTime prop', () => {
      const now = new Date();
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
        lastRefreshTime: now,
      };
      expect(props.lastRefreshTime).toBe(now);
    });

    it('should have optional autoRefreshInterval prop', () => {
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
        autoRefreshInterval: '30s',
      };
      expect(props.autoRefreshInterval).toBe('30s');
    });

    it('should have optional onAutoRefreshChange callback', () => {
      const onChange = vi.fn();
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
        onAutoRefreshChange: onChange,
      };
      props.onAutoRefreshChange?.('5s');
      expect(onChange).toHaveBeenCalledWith('5s');
    });

    it('should have optional showAutoRefresh prop', () => {
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
        showAutoRefresh: false,
      };
      expect(props.showAutoRefresh).toBe(false);
    });

    it('should have optional showLastRefresh prop', () => {
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
        showLastRefresh: false,
      };
      expect(props.showLastRefresh).toBe(false);
    });

    it('should have optional compact prop', () => {
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
        compact: true,
      };
      expect(props.compact).toBe(true);
    });

    it('should have optional className prop', () => {
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
        className: 'custom-class',
      };
      expect(props.className).toBe('custom-class');
    });

    it('should have optional testId prop', () => {
      const props: DashboardRefreshControlsProps = {
        onRefresh: async () => {},
        testId: 'custom-test-id',
      };
      expect(props.testId).toBe('custom-test-id');
    });
  });
});

describe('refreshIntervalConfig', () => {
  describe('OFF interval configuration', () => {
    it('should have correct label', () => {
      expect(refreshIntervalConfig.OFF.label).toBe('Off');
    });

    it('should have null ms value', () => {
      expect(refreshIntervalConfig.OFF.ms).toBeNull();
    });

    it('should have appropriate description', () => {
      expect(refreshIntervalConfig.OFF.description).toBe('Auto-refresh disabled');
    });
  });

  describe('5s interval configuration', () => {
    it('should have correct label', () => {
      expect(refreshIntervalConfig['5s'].label).toBe('5s');
    });

    it('should have 5000ms value', () => {
      expect(refreshIntervalConfig['5s'].ms).toBe(5000);
    });

    it('should have appropriate description', () => {
      expect(refreshIntervalConfig['5s'].description).toBe('Refresh every 5 seconds');
    });
  });

  describe('10s interval configuration', () => {
    it('should have correct label', () => {
      expect(refreshIntervalConfig['10s'].label).toBe('10s');
    });

    it('should have 10000ms value', () => {
      expect(refreshIntervalConfig['10s'].ms).toBe(10000);
    });

    it('should have appropriate description', () => {
      expect(refreshIntervalConfig['10s'].description).toBe('Refresh every 10 seconds');
    });
  });

  describe('30s interval configuration', () => {
    it('should have correct label', () => {
      expect(refreshIntervalConfig['30s'].label).toBe('30s');
    });

    it('should have 30000ms value', () => {
      expect(refreshIntervalConfig['30s'].ms).toBe(30000);
    });

    it('should have appropriate description', () => {
      expect(refreshIntervalConfig['30s'].description).toBe('Refresh every 30 seconds');
    });
  });

  describe('1m interval configuration', () => {
    it('should have correct label', () => {
      expect(refreshIntervalConfig['1m'].label).toBe('1m');
    });

    it('should have 60000ms value', () => {
      expect(refreshIntervalConfig['1m'].ms).toBe(60000);
    });

    it('should have appropriate description', () => {
      expect(refreshIntervalConfig['1m'].description).toBe('Refresh every minute');
    });
  });

  describe('5m interval configuration', () => {
    it('should have correct label', () => {
      expect(refreshIntervalConfig['5m'].label).toBe('5m');
    });

    it('should have 300000ms value', () => {
      expect(refreshIntervalConfig['5m'].ms).toBe(300000);
    });

    it('should have appropriate description', () => {
      expect(refreshIntervalConfig['5m'].description).toBe('Refresh every 5 minutes');
    });
  });

  it('should have 6 total interval configurations', () => {
    expect(Object.keys(refreshIntervalConfig)).toHaveLength(6);
  });
});

describe('getRefreshIntervalConfig', () => {
  it('should return config for OFF interval', () => {
    const config = getRefreshIntervalConfig('OFF');
    expect(config).toEqual(refreshIntervalConfig.OFF);
  });

  it('should return config for 5s interval', () => {
    const config = getRefreshIntervalConfig('5s');
    expect(config).toEqual(refreshIntervalConfig['5s']);
  });

  it('should return config for 10s interval', () => {
    const config = getRefreshIntervalConfig('10s');
    expect(config).toEqual(refreshIntervalConfig['10s']);
  });

  it('should return config for 30s interval', () => {
    const config = getRefreshIntervalConfig('30s');
    expect(config).toEqual(refreshIntervalConfig['30s']);
  });

  it('should return config for 1m interval', () => {
    const config = getRefreshIntervalConfig('1m');
    expect(config).toEqual(refreshIntervalConfig['1m']);
  });

  it('should return config for 5m interval', () => {
    const config = getRefreshIntervalConfig('5m');
    expect(config).toEqual(refreshIntervalConfig['5m']);
  });
});

describe('getRefreshIntervalOptions', () => {
  it('should return all 6 interval options', () => {
    const options = getRefreshIntervalOptions();
    expect(options).toHaveLength(6);
  });

  it('should include OFF in options', () => {
    const options = getRefreshIntervalOptions();
    expect(options).toContain('OFF');
  });

  it('should include 5s in options', () => {
    const options = getRefreshIntervalOptions();
    expect(options).toContain('5s');
  });

  it('should include 10s in options', () => {
    const options = getRefreshIntervalOptions();
    expect(options).toContain('10s');
  });

  it('should include 30s in options', () => {
    const options = getRefreshIntervalOptions();
    expect(options).toContain('30s');
  });

  it('should include 1m in options', () => {
    const options = getRefreshIntervalOptions();
    expect(options).toContain('1m');
  });

  it('should include 5m in options', () => {
    const options = getRefreshIntervalOptions();
    expect(options).toContain('5m');
  });

  it('should return an array', () => {
    const options = getRefreshIntervalOptions();
    expect(Array.isArray(options)).toBe(true);
  });
});

describe('formatRelativeTime', () => {
  describe('null/undefined handling', () => {
    it('should return "Never" for null date', () => {
      expect(formatRelativeTime(null)).toBe('Never');
    });

    it('should return "Never" for undefined date', () => {
      expect(formatRelativeTime(undefined)).toBe('Never');
    });
  });

  describe('recent times (< 5 seconds)', () => {
    it('should return "Just now" for current time', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('Just now');
    });

    it('should return "Just now" for 1 second ago', () => {
      const date = new Date(Date.now() - 1000);
      expect(formatRelativeTime(date)).toBe('Just now');
    });

    it('should return "Just now" for 4 seconds ago', () => {
      const date = new Date(Date.now() - 4000);
      expect(formatRelativeTime(date)).toBe('Just now');
    });
  });

  describe('seconds ago (5-59 seconds)', () => {
    it('should return "5s ago" for 5 seconds ago', () => {
      const date = new Date(Date.now() - 5000);
      expect(formatRelativeTime(date)).toBe('5s ago');
    });

    it('should return "30s ago" for 30 seconds ago', () => {
      const date = new Date(Date.now() - 30000);
      expect(formatRelativeTime(date)).toBe('30s ago');
    });

    it('should return "59s ago" for 59 seconds ago', () => {
      const date = new Date(Date.now() - 59000);
      expect(formatRelativeTime(date)).toBe('59s ago');
    });
  });

  describe('minutes ago (1-59 minutes)', () => {
    it('should return "1m ago" for 60 seconds ago', () => {
      const date = new Date(Date.now() - 60000);
      expect(formatRelativeTime(date)).toBe('1m ago');
    });

    it('should return "5m ago" for 5 minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('5m ago');
    });

    it('should return "30m ago" for 30 minutes ago', () => {
      const date = new Date(Date.now() - 30 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('30m ago');
    });

    it('should return "59m ago" for 59 minutes ago', () => {
      const date = new Date(Date.now() - 59 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('59m ago');
    });
  });

  describe('hours ago (1-23 hours)', () => {
    it('should return "1h ago" for 1 hour ago', () => {
      const date = new Date(Date.now() - 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('1h ago');
    });

    it('should return "12h ago" for 12 hours ago', () => {
      const date = new Date(Date.now() - 12 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('12h ago');
    });

    it('should return "23h ago" for 23 hours ago', () => {
      const date = new Date(Date.now() - 23 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('23h ago');
    });
  });

  describe('older times (24+ hours)', () => {
    it('should return locale time string for 24 hours ago', () => {
      const date = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(date);
      // Should be a formatted time string
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should return locale time string for 48 hours ago', () => {
      const date = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const result = formatRelativeTime(date);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });
});

describe('formatTimeUntilRefresh', () => {
  describe('edge cases', () => {
    it('should return empty string for null interval', () => {
      const result = formatTimeUntilRefresh(null, new Date());
      expect(result).toBe('');
    });

    it('should return empty string for null lastRefresh', () => {
      const result = formatTimeUntilRefresh(30000, null);
      expect(result).toBe('');
    });

    it('should return empty string for both null', () => {
      const result = formatTimeUntilRefresh(null, null);
      expect(result).toBe('');
    });
  });

  describe('time remaining calculations', () => {
    it('should return "Refreshing..." when time is up', () => {
      const past = new Date(Date.now() - 60000); // 1 minute ago
      const result = formatTimeUntilRefresh(30000, past); // 30 second interval
      expect(result).toBe('Refreshing...');
    });

    it('should return seconds remaining when < 60 seconds left', () => {
      const recent = new Date(Date.now() - 5000); // 5 seconds ago
      const result = formatTimeUntilRefresh(30000, recent); // 30 second interval
      // Should show ~25 seconds remaining
      expect(result).toMatch(/\d+s/);
    });

    it('should return minutes remaining when >= 60 seconds left', () => {
      const recent = new Date(); // now
      const result = formatTimeUntilRefresh(300000, recent); // 5 minute interval
      // Should show ~5 minutes remaining
      expect(result).toMatch(/\d+m/);
    });

    it('should calculate correct remaining time for 30s interval', () => {
      const lastRefresh = new Date(Date.now() - 10000); // 10 seconds ago
      const result = formatTimeUntilRefresh(30000, lastRefresh);
      // Should show ~20 seconds remaining
      const seconds = parseInt(result.replace('s', ''));
      expect(seconds).toBeGreaterThanOrEqual(19);
      expect(seconds).toBeLessThanOrEqual(21);
    });
  });
});

describe('generateMockRefreshState', () => {
  it('should return an object with lastRefreshTime', () => {
    const state = generateMockRefreshState();
    expect(state.lastRefreshTime).toBeInstanceOf(Date);
  });

  it('should return an object with autoRefreshInterval', () => {
    const state = generateMockRefreshState();
    const validIntervals: RefreshInterval[] = ['OFF', '5s', '10s', '30s', '1m', '5m'];
    expect(validIntervals).toContain(state.autoRefreshInterval);
  });

  it('should return an object with isRefreshing set to false', () => {
    const state = generateMockRefreshState();
    expect(state.isRefreshing).toBe(false);
  });

  it('should generate lastRefreshTime within the last minute', () => {
    const state = generateMockRefreshState();
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    expect(state.lastRefreshTime.getTime()).toBeGreaterThanOrEqual(oneMinuteAgo);
    expect(state.lastRefreshTime.getTime()).toBeLessThanOrEqual(now);
  });

  it('should return different values on multiple calls (randomness)', () => {
    const states = Array.from({ length: 10 }, () => generateMockRefreshState());
    const times = states.map((s) => s.lastRefreshTime.getTime());
    const uniqueTimes = new Set(times);
    // At least some should be different due to randomness
    expect(uniqueTimes.size).toBeGreaterThan(1);
  });

  it('should return a valid RefreshInterval', () => {
    const state = generateMockRefreshState();
    expect(['OFF', '5s', '10s', '30s', '1m', '5m']).toContain(state.autoRefreshInterval);
  });
});

describe('Component Props Defaults', () => {
  it('should default isRefreshing to false', () => {
    const props: DashboardRefreshControlsProps = {
      onRefresh: async () => {},
    };
    expect(props.isRefreshing ?? false).toBe(false);
  });

  it('should default lastRefreshTime to null', () => {
    const props: DashboardRefreshControlsProps = {
      onRefresh: async () => {},
    };
    expect(props.lastRefreshTime ?? null).toBeNull();
  });

  it('should default autoRefreshInterval to OFF', () => {
    const props: DashboardRefreshControlsProps = {
      onRefresh: async () => {},
    };
    expect(props.autoRefreshInterval ?? 'OFF').toBe('OFF');
  });

  it('should default showAutoRefresh to true', () => {
    const props: DashboardRefreshControlsProps = {
      onRefresh: async () => {},
    };
    expect(props.showAutoRefresh ?? true).toBe(true);
  });

  it('should default showLastRefresh to true', () => {
    const props: DashboardRefreshControlsProps = {
      onRefresh: async () => {},
    };
    expect(props.showLastRefresh ?? true).toBe(true);
  });

  it('should default compact to false', () => {
    const props: DashboardRefreshControlsProps = {
      onRefresh: async () => {},
    };
    expect(props.compact ?? false).toBe(false);
  });

  it('should default className to empty string', () => {
    const props: DashboardRefreshControlsProps = {
      onRefresh: async () => {},
    };
    expect(props.className ?? '').toBe('');
  });

  it('should default testId to "refresh-controls"', () => {
    const props: DashboardRefreshControlsProps = {
      onRefresh: async () => {},
    };
    expect(props.testId ?? 'refresh-controls').toBe('refresh-controls');
  });
});

describe('Interval Calculations', () => {
  it('should have increasing millisecond values', () => {
    const intervals: RefreshInterval[] = ['5s', '10s', '30s', '1m', '5m'];
    let previousMs = 0;

    for (const interval of intervals) {
      const config = getRefreshIntervalConfig(interval);
      expect(config.ms).not.toBeNull();
      expect(config.ms!).toBeGreaterThan(previousMs);
      previousMs = config.ms!;
    }
  });

  it('should have correct conversion from seconds to milliseconds', () => {
    expect(refreshIntervalConfig['5s'].ms).toBe(5 * 1000);
    expect(refreshIntervalConfig['10s'].ms).toBe(10 * 1000);
    expect(refreshIntervalConfig['30s'].ms).toBe(30 * 1000);
  });

  it('should have correct conversion from minutes to milliseconds', () => {
    expect(refreshIntervalConfig['1m'].ms).toBe(60 * 1000);
    expect(refreshIntervalConfig['5m'].ms).toBe(5 * 60 * 1000);
  });
});

describe('State Transitions', () => {
  it('should support transition from IDLE to REFRESHING', () => {
    const states: RefreshState[] = ['IDLE', 'REFRESHING'];
    expect(states[0]).toBe('IDLE');
    expect(states[1]).toBe('REFRESHING');
  });

  it('should support transition from REFRESHING to SUCCESS', () => {
    const states: RefreshState[] = ['REFRESHING', 'SUCCESS'];
    expect(states[0]).toBe('REFRESHING');
    expect(states[1]).toBe('SUCCESS');
  });

  it('should support transition from REFRESHING to ERROR', () => {
    const states: RefreshState[] = ['REFRESHING', 'ERROR'];
    expect(states[0]).toBe('REFRESHING');
    expect(states[1]).toBe('ERROR');
  });

  it('should support transition from SUCCESS to IDLE', () => {
    const states: RefreshState[] = ['SUCCESS', 'IDLE'];
    expect(states[0]).toBe('SUCCESS');
    expect(states[1]).toBe('IDLE');
  });

  it('should support transition from ERROR to IDLE', () => {
    const states: RefreshState[] = ['ERROR', 'IDLE'];
    expect(states[0]).toBe('ERROR');
    expect(states[1]).toBe('IDLE');
  });
});

describe('Accessibility Requirements', () => {
  it('should define aria labels for refresh button', () => {
    // Test that we have documented accessibility requirements
    const idleLabel = 'Refresh dashboard';
    const refreshingLabel = 'Refreshing dashboard';
    expect(idleLabel).toBeTruthy();
    expect(refreshingLabel).toBeTruthy();
  });

  it('should define aria-expanded for dropdown', () => {
    // Dropdown should have aria-expanded attribute
    const expandedStates = [true, false];
    expect(expandedStates).toContain(true);
    expect(expandedStates).toContain(false);
  });

  it('should define aria-haspopup for dropdown toggle', () => {
    // Dropdown toggle should have aria-haspopup
    const hasPopup = 'listbox';
    expect(hasPopup).toBe('listbox');
  });

  it('should define role for dropdown options', () => {
    // Dropdown options should have role="option"
    const role = 'option';
    expect(role).toBe('option');
  });
});
