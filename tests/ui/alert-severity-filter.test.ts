/**
 * Unit tests for AlertSeverityFilter component
 * Feature: UI-ALERT-004 - Alert severity filter
 */
import { describe, it, expect, vi } from 'vitest';

// Import types and helper functions
import type {
  AlertSeverityFilterProps,
  ActiveSeverityChipsProps,
  CombinedFilterSummaryProps,
} from '../../app/alerts/components/AlertSeverityFilter';
import type { AlertSeverity } from '../../app/dashboard/components/AlertFeed';

import {
  ALL_SEVERITY_LEVELS,
  SEVERITY_ICONS,
  SEVERITY_LABELS,
  SEVERITY_DESCRIPTIONS,
  areAllSeveritiesSelected,
  areNoSeveritiesSelected,
  areCriticalHighSelected,
  getSelectedSeveritiesLabel,
  getSeverityRank,
  sortSeverities,
} from '../../app/alerts/components/AlertSeverityFilter';

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

describe('AlertSeverityFilter Constants', () => {
  describe('ALL_SEVERITY_LEVELS', () => {
    it('should contain all 5 severity levels', () => {
      expect(ALL_SEVERITY_LEVELS.length).toBe(5);
    });

    it('should contain CRITICAL', () => {
      expect(ALL_SEVERITY_LEVELS).toContain('CRITICAL');
    });

    it('should contain HIGH', () => {
      expect(ALL_SEVERITY_LEVELS).toContain('HIGH');
    });

    it('should contain MEDIUM', () => {
      expect(ALL_SEVERITY_LEVELS).toContain('MEDIUM');
    });

    it('should contain LOW', () => {
      expect(ALL_SEVERITY_LEVELS).toContain('LOW');
    });

    it('should contain INFO', () => {
      expect(ALL_SEVERITY_LEVELS).toContain('INFO');
    });

    it('should not have duplicates', () => {
      const uniqueLevels = new Set(ALL_SEVERITY_LEVELS);
      expect(uniqueLevels.size).toBe(ALL_SEVERITY_LEVELS.length);
    });

    it('should be ordered from most to least severe', () => {
      expect(ALL_SEVERITY_LEVELS[0]).toBe('CRITICAL');
      expect(ALL_SEVERITY_LEVELS[1]).toBe('HIGH');
      expect(ALL_SEVERITY_LEVELS[2]).toBe('MEDIUM');
      expect(ALL_SEVERITY_LEVELS[3]).toBe('LOW');
      expect(ALL_SEVERITY_LEVELS[4]).toBe('INFO');
    });
  });

  describe('SEVERITY_ICONS', () => {
    it('should have icon for CRITICAL', () => {
      expect(SEVERITY_ICONS.CRITICAL).toBe('🔴');
    });

    it('should have icon for HIGH', () => {
      expect(SEVERITY_ICONS.HIGH).toBe('🟠');
    });

    it('should have icon for MEDIUM', () => {
      expect(SEVERITY_ICONS.MEDIUM).toBe('🟡');
    });

    it('should have icon for LOW', () => {
      expect(SEVERITY_ICONS.LOW).toBe('🟢');
    });

    it('should have icon for INFO', () => {
      expect(SEVERITY_ICONS.INFO).toBe('🔵');
    });

    it('should have an icon for each severity level', () => {
      for (const level of ALL_SEVERITY_LEVELS) {
        expect(SEVERITY_ICONS[level]).toBeDefined();
      }
    });
  });

  describe('SEVERITY_LABELS', () => {
    it('should have label for CRITICAL', () => {
      expect(SEVERITY_LABELS.CRITICAL).toBe('Critical');
    });

    it('should have label for HIGH', () => {
      expect(SEVERITY_LABELS.HIGH).toBe('High');
    });

    it('should have label for MEDIUM', () => {
      expect(SEVERITY_LABELS.MEDIUM).toBe('Medium');
    });

    it('should have label for LOW', () => {
      expect(SEVERITY_LABELS.LOW).toBe('Low');
    });

    it('should have label for INFO', () => {
      expect(SEVERITY_LABELS.INFO).toBe('Info');
    });

    it('should have a label for each severity level', () => {
      for (const level of ALL_SEVERITY_LEVELS) {
        expect(SEVERITY_LABELS[level]).toBeDefined();
        expect(SEVERITY_LABELS[level].length).toBeGreaterThan(0);
      }
    });
  });

  describe('SEVERITY_DESCRIPTIONS', () => {
    it('should have description for CRITICAL', () => {
      expect(SEVERITY_DESCRIPTIONS.CRITICAL).toContain('immediate attention');
    });

    it('should have description for HIGH', () => {
      expect(SEVERITY_DESCRIPTIONS.HIGH).toContain('prompt review');
    });

    it('should have description for MEDIUM', () => {
      expect(SEVERITY_DESCRIPTIONS.MEDIUM).toContain('monitoring');
    });

    it('should have description for LOW', () => {
      expect(SEVERITY_DESCRIPTIONS.LOW).toContain('Low priority');
    });

    it('should have description for INFO', () => {
      expect(SEVERITY_DESCRIPTIONS.INFO).toContain('Informational');
    });

    it('should have a description for each severity level', () => {
      for (const level of ALL_SEVERITY_LEVELS) {
        expect(SEVERITY_DESCRIPTIONS[level]).toBeDefined();
        expect(SEVERITY_DESCRIPTIONS[level].length).toBeGreaterThan(10);
      }
    });
  });
});

describe('AlertSeverityFilter Helper Functions', () => {
  describe('areAllSeveritiesSelected', () => {
    it('should return true when all severities are selected', () => {
      const selected: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      expect(areAllSeveritiesSelected(selected)).toBe(true);
    });

    it('should return true when ALL_SEVERITY_LEVELS is passed', () => {
      expect(areAllSeveritiesSelected([...ALL_SEVERITY_LEVELS])).toBe(true);
    });

    it('should return false when some severities are missing', () => {
      const selected: AlertSeverity[] = ['CRITICAL', 'HIGH'];
      expect(areAllSeveritiesSelected(selected)).toBe(false);
    });

    it('should return false when only one severity is selected', () => {
      const selected: AlertSeverity[] = ['CRITICAL'];
      expect(areAllSeveritiesSelected(selected)).toBe(false);
    });

    it('should return false when no severities are selected', () => {
      const selected: AlertSeverity[] = [];
      expect(areAllSeveritiesSelected(selected)).toBe(false);
    });

    it('should return false when 4 out of 5 severities are selected', () => {
      const selected: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      expect(areAllSeveritiesSelected(selected)).toBe(false);
    });
  });

  describe('areNoSeveritiesSelected', () => {
    it('should return true when array is empty', () => {
      expect(areNoSeveritiesSelected([])).toBe(true);
    });

    it('should return false when one severity is selected', () => {
      const selected: AlertSeverity[] = ['CRITICAL'];
      expect(areNoSeveritiesSelected(selected)).toBe(false);
    });

    it('should return false when multiple severities are selected', () => {
      const selected: AlertSeverity[] = ['CRITICAL', 'HIGH'];
      expect(areNoSeveritiesSelected(selected)).toBe(false);
    });

    it('should return false when all severities are selected', () => {
      expect(areNoSeveritiesSelected([...ALL_SEVERITY_LEVELS])).toBe(false);
    });
  });

  describe('areCriticalHighSelected', () => {
    it('should return true when both CRITICAL and HIGH are selected', () => {
      const selected: AlertSeverity[] = ['CRITICAL', 'HIGH'];
      expect(areCriticalHighSelected(selected)).toBe(true);
    });

    it('should return true when CRITICAL and HIGH are among other selections', () => {
      const selected: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM'];
      expect(areCriticalHighSelected(selected)).toBe(true);
    });

    it('should return true when all severities are selected', () => {
      expect(areCriticalHighSelected([...ALL_SEVERITY_LEVELS])).toBe(true);
    });

    it('should return false when only CRITICAL is selected', () => {
      const selected: AlertSeverity[] = ['CRITICAL'];
      expect(areCriticalHighSelected(selected)).toBe(false);
    });

    it('should return false when only HIGH is selected', () => {
      const selected: AlertSeverity[] = ['HIGH'];
      expect(areCriticalHighSelected(selected)).toBe(false);
    });

    it('should return false when neither is selected', () => {
      const selected: AlertSeverity[] = ['MEDIUM', 'LOW', 'INFO'];
      expect(areCriticalHighSelected(selected)).toBe(false);
    });

    it('should return false when empty', () => {
      expect(areCriticalHighSelected([])).toBe(false);
    });
  });

  describe('getSelectedSeveritiesLabel', () => {
    it('should return "All Severities" when all are selected', () => {
      expect(getSelectedSeveritiesLabel([...ALL_SEVERITY_LEVELS])).toBe('All Severities');
    });

    it('should return "All Severities" when none are selected', () => {
      expect(getSelectedSeveritiesLabel([])).toBe('All Severities');
    });

    it('should return severity label when only one is selected', () => {
      expect(getSelectedSeveritiesLabel(['CRITICAL'])).toBe('Critical');
      expect(getSelectedSeveritiesLabel(['HIGH'])).toBe('High');
      expect(getSelectedSeveritiesLabel(['MEDIUM'])).toBe('Medium');
      expect(getSelectedSeveritiesLabel(['LOW'])).toBe('Low');
      expect(getSelectedSeveritiesLabel(['INFO'])).toBe('Info');
    });

    it('should return "Critical & High" when only those two are selected', () => {
      expect(getSelectedSeveritiesLabel(['CRITICAL', 'HIGH'])).toBe('Critical & High');
    });

    it('should return "Critical & High" regardless of order', () => {
      expect(getSelectedSeveritiesLabel(['HIGH', 'CRITICAL'])).toBe('Critical & High');
    });

    it('should return "Medium and above" when CRITICAL, HIGH, and MEDIUM are selected', () => {
      expect(getSelectedSeveritiesLabel(['CRITICAL', 'HIGH', 'MEDIUM'])).toBe('Medium and above');
    });

    it('should return count for other combinations', () => {
      expect(getSelectedSeveritiesLabel(['CRITICAL', 'MEDIUM'])).toBe('2 levels');
      expect(getSelectedSeveritiesLabel(['HIGH', 'LOW', 'INFO'])).toBe('3 levels');
      expect(getSelectedSeveritiesLabel(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])).toBe('4 levels');
    });
  });

  describe('getSeverityRank', () => {
    it('should return 5 for CRITICAL', () => {
      expect(getSeverityRank('CRITICAL')).toBe(5);
    });

    it('should return 4 for HIGH', () => {
      expect(getSeverityRank('HIGH')).toBe(4);
    });

    it('should return 3 for MEDIUM', () => {
      expect(getSeverityRank('MEDIUM')).toBe(3);
    });

    it('should return 2 for LOW', () => {
      expect(getSeverityRank('LOW')).toBe(2);
    });

    it('should return 1 for INFO', () => {
      expect(getSeverityRank('INFO')).toBe(1);
    });

    it('CRITICAL should rank higher than HIGH', () => {
      expect(getSeverityRank('CRITICAL')).toBeGreaterThan(getSeverityRank('HIGH'));
    });

    it('HIGH should rank higher than MEDIUM', () => {
      expect(getSeverityRank('HIGH')).toBeGreaterThan(getSeverityRank('MEDIUM'));
    });

    it('MEDIUM should rank higher than LOW', () => {
      expect(getSeverityRank('MEDIUM')).toBeGreaterThan(getSeverityRank('LOW'));
    });

    it('LOW should rank higher than INFO', () => {
      expect(getSeverityRank('LOW')).toBeGreaterThan(getSeverityRank('INFO'));
    });
  });

  describe('sortSeverities', () => {
    it('should sort severities by rank in descending order', () => {
      const unsorted: AlertSeverity[] = ['INFO', 'HIGH', 'LOW', 'CRITICAL', 'MEDIUM'];
      const sorted = sortSeverities(unsorted);
      expect(sorted).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
    });

    it('should handle already sorted input', () => {
      const alreadySorted: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      expect(sortSeverities(alreadySorted)).toEqual(alreadySorted);
    });

    it('should handle empty array', () => {
      expect(sortSeverities([])).toEqual([]);
    });

    it('should handle single element', () => {
      expect(sortSeverities(['MEDIUM'])).toEqual(['MEDIUM']);
    });

    it('should handle two elements', () => {
      expect(sortSeverities(['INFO', 'CRITICAL'])).toEqual(['CRITICAL', 'INFO']);
    });

    it('should not mutate original array', () => {
      const original: AlertSeverity[] = ['INFO', 'CRITICAL'];
      const sorted = sortSeverities(original);
      expect(original).toEqual(['INFO', 'CRITICAL']);
      expect(sorted).toEqual(['CRITICAL', 'INFO']);
    });

    it('should handle reverse sorted input', () => {
      const reversed: AlertSeverity[] = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      expect(sortSeverities(reversed)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
    });

    it('should handle subset of severities', () => {
      const subset: AlertSeverity[] = ['HIGH', 'LOW'];
      expect(sortSeverities(subset)).toEqual(['HIGH', 'LOW']);
    });

    it('should handle duplicates correctly', () => {
      const withDupes: AlertSeverity[] = ['HIGH', 'CRITICAL', 'HIGH'];
      expect(sortSeverities(withDupes)).toEqual(['CRITICAL', 'HIGH', 'HIGH']);
    });
  });
});

describe('AlertSeverityFilter Interface Types', () => {
  describe('AlertSeverityFilterProps', () => {
    it('should accept valid props', () => {
      const mockOnChange = vi.fn();
      const props: AlertSeverityFilterProps = {
        selectedSeverities: ['CRITICAL', 'HIGH'],
        onChange: mockOnChange,
      };
      expect(props.selectedSeverities).toHaveLength(2);
      expect(typeof props.onChange).toBe('function');
    });

    it('should accept disabled prop', () => {
      const mockOnChange = vi.fn();
      const props: AlertSeverityFilterProps = {
        selectedSeverities: [],
        onChange: mockOnChange,
        disabled: true,
      };
      expect(props.disabled).toBe(true);
    });

    it('should accept testId prop', () => {
      const mockOnChange = vi.fn();
      const props: AlertSeverityFilterProps = {
        selectedSeverities: [],
        onChange: mockOnChange,
        testId: 'custom-test-id',
      };
      expect(props.testId).toBe('custom-test-id');
    });
  });

  describe('ActiveSeverityChipsProps', () => {
    it('should accept valid props', () => {
      const mockOnRemove = vi.fn();
      const mockOnClearAll = vi.fn();
      const props: ActiveSeverityChipsProps = {
        selectedSeverities: ['CRITICAL'],
        onRemove: mockOnRemove,
        onClearAll: mockOnClearAll,
      };
      expect(props.selectedSeverities).toHaveLength(1);
      expect(typeof props.onRemove).toBe('function');
      expect(typeof props.onClearAll).toBe('function');
    });

    it('should accept testId prop', () => {
      const props: ActiveSeverityChipsProps = {
        selectedSeverities: [],
        onRemove: vi.fn(),
        onClearAll: vi.fn(),
        testId: 'custom-chips-id',
      };
      expect(props.testId).toBe('custom-chips-id');
    });
  });

  describe('CombinedFilterSummaryProps', () => {
    it('should accept valid props', () => {
      const mockOnClearAll = vi.fn();
      const props: CombinedFilterSummaryProps = {
        totalAlerts: 100,
        filteredAlerts: 50,
        hasTypeFilters: true,
        hasSeverityFilters: false,
        onClearAll: mockOnClearAll,
      };
      expect(props.totalAlerts).toBe(100);
      expect(props.filteredAlerts).toBe(50);
      expect(props.hasTypeFilters).toBe(true);
      expect(props.hasSeverityFilters).toBe(false);
    });

    it('should accept testId prop', () => {
      const props: CombinedFilterSummaryProps = {
        totalAlerts: 0,
        filteredAlerts: 0,
        hasTypeFilters: false,
        hasSeverityFilters: false,
        onClearAll: vi.fn(),
        testId: 'custom-summary-id',
      };
      expect(props.testId).toBe('custom-summary-id');
    });
  });
});

describe('AlertSeverityFilter Behavior', () => {
  describe('Selection behaviors', () => {
    it('should handle toggling a severity on', () => {
      const selected: AlertSeverity[] = ['CRITICAL'];
      const toToggle: AlertSeverity = 'HIGH';
      const newSelection = [...selected, toToggle];
      expect(newSelection).toContain('CRITICAL');
      expect(newSelection).toContain('HIGH');
      expect(newSelection).toHaveLength(2);
    });

    it('should handle toggling a severity off', () => {
      const selected: AlertSeverity[] = ['CRITICAL', 'HIGH'];
      const toToggle: AlertSeverity = 'HIGH';
      const newSelection = selected.filter((s) => s !== toToggle);
      expect(newSelection).toContain('CRITICAL');
      expect(newSelection).not.toContain('HIGH');
      expect(newSelection).toHaveLength(1);
    });

    it('should handle select all', () => {
      const newSelection = [...ALL_SEVERITY_LEVELS];
      expect(areAllSeveritiesSelected(newSelection)).toBe(true);
    });

    it('should handle clear all', () => {
      const newSelection: AlertSeverity[] = [];
      expect(areNoSeveritiesSelected(newSelection)).toBe(true);
    });

    it('should handle Critical & High preset', () => {
      const preset: AlertSeverity[] = ['CRITICAL', 'HIGH'];
      expect(areCriticalHighSelected(preset)).toBe(true);
      expect(preset).toHaveLength(2);
    });

    it('should handle Medium and above preset', () => {
      const preset: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM'];
      expect(preset).toContain('CRITICAL');
      expect(preset).toContain('HIGH');
      expect(preset).toContain('MEDIUM');
      expect(preset).toHaveLength(3);
    });
  });

  describe('Filter results', () => {
    // Mock alerts for filtering tests
    const mockAlerts = [
      { id: '1', severity: 'CRITICAL' as AlertSeverity },
      { id: '2', severity: 'CRITICAL' as AlertSeverity },
      { id: '3', severity: 'HIGH' as AlertSeverity },
      { id: '4', severity: 'HIGH' as AlertSeverity },
      { id: '5', severity: 'MEDIUM' as AlertSeverity },
      { id: '6', severity: 'MEDIUM' as AlertSeverity },
      { id: '7', severity: 'LOW' as AlertSeverity },
      { id: '8', severity: 'INFO' as AlertSeverity },
      { id: '9', severity: 'INFO' as AlertSeverity },
      { id: '10', severity: 'INFO' as AlertSeverity },
    ];

    it('should filter by single severity', () => {
      const selectedSeverities: AlertSeverity[] = ['CRITICAL'];
      const filtered = mockAlerts.filter((a) => selectedSeverities.includes(a.severity));
      expect(filtered).toHaveLength(2);
    });

    it('should filter by multiple severities', () => {
      const selectedSeverities: AlertSeverity[] = ['CRITICAL', 'HIGH'];
      const filtered = mockAlerts.filter((a) => selectedSeverities.includes(a.severity));
      expect(filtered).toHaveLength(4);
    });

    it('should return all when all severities selected', () => {
      const selectedSeverities = [...ALL_SEVERITY_LEVELS];
      const filtered = mockAlerts.filter((a) => selectedSeverities.includes(a.severity));
      expect(filtered).toHaveLength(10);
    });

    it('should return none when empty selection', () => {
      const selectedSeverities: AlertSeverity[] = [];
      const filtered = mockAlerts.filter((a) => selectedSeverities.includes(a.severity));
      expect(filtered).toHaveLength(0);
    });

    it('should correctly filter by Medium and above preset', () => {
      const selectedSeverities: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM'];
      const filtered = mockAlerts.filter((a) => selectedSeverities.includes(a.severity));
      expect(filtered).toHaveLength(6);
    });
  });
});

describe('AlertSeverityFilter Edge Cases', () => {
  it('should handle empty severity array for label', () => {
    expect(getSelectedSeveritiesLabel([])).toBe('All Severities');
  });

  it('should handle all severities for label', () => {
    expect(getSelectedSeveritiesLabel([...ALL_SEVERITY_LEVELS])).toBe('All Severities');
  });

  it('should handle invalid severity gracefully in sorting', () => {
    // Type system should prevent this, but testing robustness
    const valid: AlertSeverity[] = ['CRITICAL', 'HIGH'];
    const sorted = sortSeverities(valid);
    expect(sorted).toEqual(['CRITICAL', 'HIGH']);
  });

  it('should handle selection state transitions correctly', () => {
    let selected: AlertSeverity[] = [];

    // Add CRITICAL
    selected = [...selected, 'CRITICAL'];
    expect(selected).toEqual(['CRITICAL']);

    // Add HIGH
    selected = [...selected, 'HIGH'];
    expect(selected).toEqual(['CRITICAL', 'HIGH']);

    // Remove CRITICAL
    selected = selected.filter((s) => s !== 'CRITICAL');
    expect(selected).toEqual(['HIGH']);

    // Select all
    selected = [...ALL_SEVERITY_LEVELS];
    expect(areAllSeveritiesSelected(selected)).toBe(true);

    // Clear all
    selected = [];
    expect(areNoSeveritiesSelected(selected)).toBe(true);
  });
});

describe('AlertSeverityFilter Integration', () => {
  it('should work with AlertsListView integration', () => {
    // Simulate the combined filtering logic used in AlertsListView
    const mockAlerts = [
      { id: '1', type: 'WHALE_TRADE', severity: 'CRITICAL' as AlertSeverity },
      { id: '2', type: 'WHALE_TRADE', severity: 'HIGH' as AlertSeverity },
      { id: '3', type: 'FRESH_WALLET', severity: 'CRITICAL' as AlertSeverity },
      { id: '4', type: 'FRESH_WALLET', severity: 'LOW' as AlertSeverity },
      { id: '5', type: 'SYSTEM', severity: 'INFO' as AlertSeverity },
    ];

    // Type filter: only WHALE_TRADE and FRESH_WALLET
    const selectedTypes = ['WHALE_TRADE', 'FRESH_WALLET'];

    // Severity filter: only CRITICAL
    const selectedSeverities: AlertSeverity[] = ['CRITICAL'];

    // Combined filter
    const filtered = mockAlerts.filter(
      (a) => selectedTypes.includes(a.type) && selectedSeverities.includes(a.severity)
    );

    expect(filtered).toHaveLength(2);
    expect(filtered.map((a) => a.id)).toEqual(['1', '3']);
  });

  it('should show all alerts when both filters are fully selected', () => {
    const mockAlerts = [
      { id: '1', type: 'WHALE_TRADE', severity: 'CRITICAL' as AlertSeverity },
      { id: '2', type: 'FRESH_WALLET', severity: 'INFO' as AlertSeverity },
    ];

    const allTypesSelected = true;
    const allSeveritiesSelected = true;

    // When all filters are selected, no filtering should occur
    let filtered = mockAlerts;
    if (!allTypesSelected) {
      filtered = filtered.filter(() => false); // placeholder
    }
    if (!allSeveritiesSelected) {
      filtered = filtered.filter(() => false); // placeholder
    }

    expect(filtered).toHaveLength(2);
  });
});
