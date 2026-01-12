/**
 * Unit tests for AlertTypeFilter component
 * Feature: UI-ALERT-003 - Alert type filter
 */
import { describe, it, expect, vi } from 'vitest';

// Import types and helper functions
import type {
  AlertTypeFilterProps,
  ActiveFilterChipsProps,
  AlertTypeCategory,
} from '../../app/alerts/components/AlertTypeFilter';
import type { AlertType } from '../../app/dashboard/components/AlertFeed';

import {
  ALL_ALERT_TYPES,
  ALERT_TYPE_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  getTypeCategory,
  areAllTypesSelected,
  areNoTypesSelected,
  areCategoryTypesSelected,
  areSomeCategoryTypesSelected,
  getSelectedTypesLabel,
} from '../../app/alerts/components/AlertTypeFilter';

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

describe('AlertTypeFilter Constants', () => {
  describe('ALL_ALERT_TYPES', () => {
    it('should contain all 12 alert types', () => {
      expect(ALL_ALERT_TYPES.length).toBe(12);
    });

    it('should contain WHALE_TRADE', () => {
      expect(ALL_ALERT_TYPES).toContain('WHALE_TRADE');
    });

    it('should contain PRICE_MOVEMENT', () => {
      expect(ALL_ALERT_TYPES).toContain('PRICE_MOVEMENT');
    });

    it('should contain INSIDER_ACTIVITY', () => {
      expect(ALL_ALERT_TYPES).toContain('INSIDER_ACTIVITY');
    });

    it('should contain FRESH_WALLET', () => {
      expect(ALL_ALERT_TYPES).toContain('FRESH_WALLET');
    });

    it('should contain WALLET_REACTIVATION', () => {
      expect(ALL_ALERT_TYPES).toContain('WALLET_REACTIVATION');
    });

    it('should contain COORDINATED_ACTIVITY', () => {
      expect(ALL_ALERT_TYPES).toContain('COORDINATED_ACTIVITY');
    });

    it('should contain UNUSUAL_PATTERN', () => {
      expect(ALL_ALERT_TYPES).toContain('UNUSUAL_PATTERN');
    });

    it('should contain MARKET_RESOLVED', () => {
      expect(ALL_ALERT_TYPES).toContain('MARKET_RESOLVED');
    });

    it('should contain NEW_MARKET', () => {
      expect(ALL_ALERT_TYPES).toContain('NEW_MARKET');
    });

    it('should contain SUSPICIOUS_FUNDING', () => {
      expect(ALL_ALERT_TYPES).toContain('SUSPICIOUS_FUNDING');
    });

    it('should contain SANCTIONED_ACTIVITY', () => {
      expect(ALL_ALERT_TYPES).toContain('SANCTIONED_ACTIVITY');
    });

    it('should contain SYSTEM', () => {
      expect(ALL_ALERT_TYPES).toContain('SYSTEM');
    });

    it('should not have duplicates', () => {
      const uniqueTypes = new Set(ALL_ALERT_TYPES);
      expect(uniqueTypes.size).toBe(ALL_ALERT_TYPES.length);
    });
  });

  describe('ALERT_TYPE_CATEGORIES', () => {
    it('should have 4 categories', () => {
      const categories = Object.keys(ALERT_TYPE_CATEGORIES);
      expect(categories.length).toBe(4);
    });

    it('should have TRADING category', () => {
      expect(ALERT_TYPE_CATEGORIES.TRADING).toBeDefined();
    });

    it('should have WALLET category', () => {
      expect(ALERT_TYPE_CATEGORIES.WALLET).toBeDefined();
    });

    it('should have MARKET category', () => {
      expect(ALERT_TYPE_CATEGORIES.MARKET).toBeDefined();
    });

    it('should have SYSTEM category', () => {
      expect(ALERT_TYPE_CATEGORIES.SYSTEM).toBeDefined();
    });

    it('TRADING category should contain correct types', () => {
      const tradingTypes = ALERT_TYPE_CATEGORIES.TRADING;
      expect(tradingTypes).toContain('WHALE_TRADE');
      expect(tradingTypes).toContain('PRICE_MOVEMENT');
      expect(tradingTypes).toContain('INSIDER_ACTIVITY');
      expect(tradingTypes).toContain('COORDINATED_ACTIVITY');
    });

    it('WALLET category should contain correct types', () => {
      const walletTypes = ALERT_TYPE_CATEGORIES.WALLET;
      expect(walletTypes).toContain('FRESH_WALLET');
      expect(walletTypes).toContain('WALLET_REACTIVATION');
      expect(walletTypes).toContain('SUSPICIOUS_FUNDING');
      expect(walletTypes).toContain('SANCTIONED_ACTIVITY');
    });

    it('MARKET category should contain correct types', () => {
      const marketTypes = ALERT_TYPE_CATEGORIES.MARKET;
      expect(marketTypes).toContain('UNUSUAL_PATTERN');
      expect(marketTypes).toContain('MARKET_RESOLVED');
      expect(marketTypes).toContain('NEW_MARKET');
    });

    it('SYSTEM category should contain SYSTEM type', () => {
      const systemTypes = ALERT_TYPE_CATEGORIES.SYSTEM;
      expect(systemTypes).toContain('SYSTEM');
    });

    it('all types should be covered by categories', () => {
      const allCategoryTypes = Object.values(ALERT_TYPE_CATEGORIES).flat();
      expect(allCategoryTypes.sort()).toEqual([...ALL_ALERT_TYPES].sort());
    });
  });

  describe('CATEGORY_LABELS', () => {
    it('should have label for TRADING', () => {
      expect(CATEGORY_LABELS.TRADING).toBe('Trading Activity');
    });

    it('should have label for WALLET', () => {
      expect(CATEGORY_LABELS.WALLET).toBe('Wallet Activity');
    });

    it('should have label for MARKET', () => {
      expect(CATEGORY_LABELS.MARKET).toBe('Market Events');
    });

    it('should have label for SYSTEM', () => {
      expect(CATEGORY_LABELS.SYSTEM).toBe('System');
    });
  });

  describe('CATEGORY_ICONS', () => {
    it('should have icon for each category', () => {
      expect(CATEGORY_ICONS.TRADING).toBeDefined();
      expect(CATEGORY_ICONS.WALLET).toBeDefined();
      expect(CATEGORY_ICONS.MARKET).toBeDefined();
      expect(CATEGORY_ICONS.SYSTEM).toBeDefined();
    });

    it('TRADING icon should be chart emoji', () => {
      expect(CATEGORY_ICONS.TRADING).toBe('💹');
    });

    it('WALLET icon should be wallet emoji', () => {
      expect(CATEGORY_ICONS.WALLET).toBe('👛');
    });

    it('MARKET icon should be chart emoji', () => {
      expect(CATEGORY_ICONS.MARKET).toBe('📊');
    });

    it('SYSTEM icon should be gear emoji', () => {
      expect(CATEGORY_ICONS.SYSTEM).toBe('⚙️');
    });
  });
});

describe('AlertTypeFilter Helper Functions', () => {
  describe('getTypeCategory', () => {
    it('should return TRADING for WHALE_TRADE', () => {
      expect(getTypeCategory('WHALE_TRADE')).toBe('TRADING');
    });

    it('should return TRADING for PRICE_MOVEMENT', () => {
      expect(getTypeCategory('PRICE_MOVEMENT')).toBe('TRADING');
    });

    it('should return TRADING for INSIDER_ACTIVITY', () => {
      expect(getTypeCategory('INSIDER_ACTIVITY')).toBe('TRADING');
    });

    it('should return TRADING for COORDINATED_ACTIVITY', () => {
      expect(getTypeCategory('COORDINATED_ACTIVITY')).toBe('TRADING');
    });

    it('should return WALLET for FRESH_WALLET', () => {
      expect(getTypeCategory('FRESH_WALLET')).toBe('WALLET');
    });

    it('should return WALLET for WALLET_REACTIVATION', () => {
      expect(getTypeCategory('WALLET_REACTIVATION')).toBe('WALLET');
    });

    it('should return WALLET for SUSPICIOUS_FUNDING', () => {
      expect(getTypeCategory('SUSPICIOUS_FUNDING')).toBe('WALLET');
    });

    it('should return WALLET for SANCTIONED_ACTIVITY', () => {
      expect(getTypeCategory('SANCTIONED_ACTIVITY')).toBe('WALLET');
    });

    it('should return MARKET for UNUSUAL_PATTERN', () => {
      expect(getTypeCategory('UNUSUAL_PATTERN')).toBe('MARKET');
    });

    it('should return MARKET for MARKET_RESOLVED', () => {
      expect(getTypeCategory('MARKET_RESOLVED')).toBe('MARKET');
    });

    it('should return MARKET for NEW_MARKET', () => {
      expect(getTypeCategory('NEW_MARKET')).toBe('MARKET');
    });

    it('should return SYSTEM for SYSTEM', () => {
      expect(getTypeCategory('SYSTEM')).toBe('SYSTEM');
    });
  });

  describe('areAllTypesSelected', () => {
    it('should return true when all types are selected', () => {
      expect(areAllTypesSelected([...ALL_ALERT_TYPES])).toBe(true);
    });

    it('should return false when some types are missing', () => {
      const partialTypes = ALL_ALERT_TYPES.slice(0, 5);
      expect(areAllTypesSelected(partialTypes)).toBe(false);
    });

    it('should return false when no types are selected', () => {
      expect(areAllTypesSelected([])).toBe(false);
    });

    it('should return false when only one type is selected', () => {
      expect(areAllTypesSelected(['WHALE_TRADE'])).toBe(false);
    });

    it('should return true with types in different order', () => {
      const shuffled = [...ALL_ALERT_TYPES].reverse();
      expect(areAllTypesSelected(shuffled)).toBe(true);
    });
  });

  describe('areNoTypesSelected', () => {
    it('should return true when no types are selected', () => {
      expect(areNoTypesSelected([])).toBe(true);
    });

    it('should return false when one type is selected', () => {
      expect(areNoTypesSelected(['WHALE_TRADE'])).toBe(false);
    });

    it('should return false when all types are selected', () => {
      expect(areNoTypesSelected([...ALL_ALERT_TYPES])).toBe(false);
    });

    it('should return false when some types are selected', () => {
      expect(areNoTypesSelected(['WHALE_TRADE', 'FRESH_WALLET'])).toBe(false);
    });
  });

  describe('areCategoryTypesSelected', () => {
    it('should return true when all TRADING types are selected', () => {
      const tradingTypes = ALERT_TYPE_CATEGORIES.TRADING;
      expect(areCategoryTypesSelected(tradingTypes, 'TRADING')).toBe(true);
    });

    it('should return false when some TRADING types are missing', () => {
      const partialTrading: AlertType[] = ['WHALE_TRADE', 'PRICE_MOVEMENT'];
      expect(areCategoryTypesSelected(partialTrading, 'TRADING')).toBe(false);
    });

    it('should return true when all WALLET types are selected', () => {
      const walletTypes = ALERT_TYPE_CATEGORIES.WALLET;
      expect(areCategoryTypesSelected(walletTypes, 'WALLET')).toBe(true);
    });

    it('should return true when all MARKET types are selected', () => {
      const marketTypes = ALERT_TYPE_CATEGORIES.MARKET;
      expect(areCategoryTypesSelected(marketTypes, 'MARKET')).toBe(true);
    });

    it('should return true when SYSTEM type is selected for SYSTEM category', () => {
      expect(areCategoryTypesSelected(['SYSTEM'], 'SYSTEM')).toBe(true);
    });

    it('should return true when all types including category are selected', () => {
      expect(areCategoryTypesSelected([...ALL_ALERT_TYPES], 'TRADING')).toBe(true);
    });
  });

  describe('areSomeCategoryTypesSelected', () => {
    it('should return true when some but not all TRADING types are selected', () => {
      const partialTrading: AlertType[] = ['WHALE_TRADE', 'PRICE_MOVEMENT'];
      expect(areSomeCategoryTypesSelected(partialTrading, 'TRADING')).toBe(true);
    });

    it('should return false when all TRADING types are selected', () => {
      const tradingTypes = ALERT_TYPE_CATEGORIES.TRADING;
      expect(areSomeCategoryTypesSelected(tradingTypes, 'TRADING')).toBe(false);
    });

    it('should return false when no TRADING types are selected', () => {
      const walletTypes = ALERT_TYPE_CATEGORIES.WALLET;
      expect(areSomeCategoryTypesSelected(walletTypes, 'TRADING')).toBe(false);
    });

    it('should return true when one WALLET type is selected', () => {
      expect(areSomeCategoryTypesSelected(['FRESH_WALLET'], 'WALLET')).toBe(true);
    });

    it('should return false for SYSTEM when SYSTEM is selected (only one type in category)', () => {
      // SYSTEM category only has one type, so selecting it means all are selected
      expect(areSomeCategoryTypesSelected(['SYSTEM'], 'SYSTEM')).toBe(false);
    });
  });

  describe('getSelectedTypesLabel', () => {
    it('should return "All Types" when all types are selected', () => {
      expect(getSelectedTypesLabel([...ALL_ALERT_TYPES])).toBe('All Types');
    });

    it('should return "All Types" when no types are selected', () => {
      expect(getSelectedTypesLabel([])).toBe('All Types');
    });

    it('should return type label when one type is selected', () => {
      expect(getSelectedTypesLabel(['WHALE_TRADE'])).toBe('Whale Trade');
    });

    it('should return "2 types" when two types are selected', () => {
      expect(getSelectedTypesLabel(['WHALE_TRADE', 'FRESH_WALLET'])).toBe('2 types');
    });

    it('should return "5 types" when five types are selected', () => {
      const fiveTypes: AlertType[] = [
        'WHALE_TRADE',
        'PRICE_MOVEMENT',
        'FRESH_WALLET',
        'UNUSUAL_PATTERN',
        'SYSTEM',
      ];
      expect(getSelectedTypesLabel(fiveTypes)).toBe('5 types');
    });

    it('should return category label when entire category is selected', () => {
      const tradingTypes = ALERT_TYPE_CATEGORIES.TRADING;
      expect(getSelectedTypesLabel(tradingTypes)).toBe('Trading Activity');
    });

    it('should return category label for WALLET category', () => {
      const walletTypes = ALERT_TYPE_CATEGORIES.WALLET;
      expect(getSelectedTypesLabel(walletTypes)).toBe('Wallet Activity');
    });

    it('should return category label for MARKET category', () => {
      const marketTypes = ALERT_TYPE_CATEGORIES.MARKET;
      expect(getSelectedTypesLabel(marketTypes)).toBe('Market Events');
    });

    it('should return "X types" when category plus extra types', () => {
      const tradingPlusOne = [...ALERT_TYPE_CATEGORIES.TRADING, 'FRESH_WALLET'] as AlertType[];
      expect(getSelectedTypesLabel(tradingPlusOne)).toBe('5 types');
    });
  });
});

describe('AlertTypeFilterProps Interface', () => {
  it('should accept required props', () => {
    const props: AlertTypeFilterProps = {
      selectedTypes: ['WHALE_TRADE'],
      onChange: vi.fn(),
    };

    expect(props.selectedTypes).toContain('WHALE_TRADE');
    expect(typeof props.onChange).toBe('function');
  });

  it('should accept optional disabled prop', () => {
    const props: AlertTypeFilterProps = {
      selectedTypes: ['WHALE_TRADE'],
      onChange: vi.fn(),
      disabled: true,
    };

    expect(props.disabled).toBe(true);
  });

  it('should accept optional testId prop', () => {
    const props: AlertTypeFilterProps = {
      selectedTypes: ['WHALE_TRADE'],
      onChange: vi.fn(),
      testId: 'custom-test-id',
    };

    expect(props.testId).toBe('custom-test-id');
  });

  it('should accept empty selectedTypes array', () => {
    const props: AlertTypeFilterProps = {
      selectedTypes: [],
      onChange: vi.fn(),
    };

    expect(props.selectedTypes).toHaveLength(0);
  });

  it('should accept all types selected', () => {
    const props: AlertTypeFilterProps = {
      selectedTypes: [...ALL_ALERT_TYPES],
      onChange: vi.fn(),
    };

    expect(props.selectedTypes).toHaveLength(12);
  });
});

describe('ActiveFilterChipsProps Interface', () => {
  it('should accept required props', () => {
    const props: ActiveFilterChipsProps = {
      selectedTypes: ['WHALE_TRADE', 'FRESH_WALLET'],
      onRemove: vi.fn(),
      onClearAll: vi.fn(),
    };

    expect(props.selectedTypes).toHaveLength(2);
    expect(typeof props.onRemove).toBe('function');
    expect(typeof props.onClearAll).toBe('function');
  });

  it('should accept optional testId prop', () => {
    const props: ActiveFilterChipsProps = {
      selectedTypes: ['WHALE_TRADE'],
      onRemove: vi.fn(),
      onClearAll: vi.fn(),
      testId: 'custom-chips-id',
    };

    expect(props.testId).toBe('custom-chips-id');
  });

  it('should accept single selected type', () => {
    const props: ActiveFilterChipsProps = {
      selectedTypes: ['SYSTEM'],
      onRemove: vi.fn(),
      onClearAll: vi.fn(),
    };

    expect(props.selectedTypes[0]).toBe('SYSTEM');
  });

  it('should accept multiple categories of types', () => {
    const mixedTypes: AlertType[] = [
      'WHALE_TRADE', // TRADING
      'FRESH_WALLET', // WALLET
      'NEW_MARKET', // MARKET
      'SYSTEM', // SYSTEM
    ];

    const props: ActiveFilterChipsProps = {
      selectedTypes: mixedTypes,
      onRemove: vi.fn(),
      onClearAll: vi.fn(),
    };

    expect(props.selectedTypes).toHaveLength(4);
  });
});

describe('AlertTypeCategory Type', () => {
  it('should allow TRADING category', () => {
    const category: AlertTypeCategory = 'TRADING';
    expect(category).toBe('TRADING');
  });

  it('should allow WALLET category', () => {
    const category: AlertTypeCategory = 'WALLET';
    expect(category).toBe('WALLET');
  });

  it('should allow MARKET category', () => {
    const category: AlertTypeCategory = 'MARKET';
    expect(category).toBe('MARKET');
  });

  it('should allow SYSTEM category', () => {
    const category: AlertTypeCategory = 'SYSTEM';
    expect(category).toBe('SYSTEM');
  });
});

describe('Filter Logic', () => {
  describe('Single type toggle', () => {
    it('should add type when not selected', () => {
      const selectedTypes: AlertType[] = ['WHALE_TRADE'];
      const typeToToggle: AlertType = 'FRESH_WALLET';

      const isSelected = selectedTypes.includes(typeToToggle);
      expect(isSelected).toBe(false);

      const newTypes = [...selectedTypes, typeToToggle];
      expect(newTypes).toContain('FRESH_WALLET');
      expect(newTypes).toHaveLength(2);
    });

    it('should remove type when already selected', () => {
      const selectedTypes: AlertType[] = ['WHALE_TRADE', 'FRESH_WALLET'];
      const typeToToggle: AlertType = 'FRESH_WALLET';

      const isSelected = selectedTypes.includes(typeToToggle);
      expect(isSelected).toBe(true);

      const newTypes = selectedTypes.filter((t) => t !== typeToToggle);
      expect(newTypes).not.toContain('FRESH_WALLET');
      expect(newTypes).toHaveLength(1);
    });
  });

  describe('Category toggle', () => {
    it('should add all category types when none selected', () => {
      const selectedTypes: AlertType[] = [];
      const categoryTypes = ALERT_TYPE_CATEGORIES.TRADING;

      const newTypes = [...selectedTypes, ...categoryTypes];
      expect(newTypes).toHaveLength(4);
      categoryTypes.forEach((type) => {
        expect(newTypes).toContain(type);
      });
    });

    it('should remove all category types when all selected', () => {
      const selectedTypes = [...ALERT_TYPE_CATEGORIES.TRADING];
      const categoryTypes = ALERT_TYPE_CATEGORIES.TRADING;

      const newTypes = selectedTypes.filter((type) => !categoryTypes.includes(type));
      expect(newTypes).toHaveLength(0);
    });

    it('should add remaining category types when some selected', () => {
      const selectedTypes: AlertType[] = ['WHALE_TRADE', 'PRICE_MOVEMENT'];
      const categoryTypes = ALERT_TYPE_CATEGORIES.TRADING;

      const typesToAdd = categoryTypes.filter((type) => !selectedTypes.includes(type));
      const newTypes = [...selectedTypes, ...typesToAdd];

      expect(newTypes).toHaveLength(4);
      categoryTypes.forEach((type) => {
        expect(newTypes).toContain(type);
      });
    });
  });

  describe('Select all / Clear all', () => {
    it('should select all types', () => {
      const newTypes = [...ALL_ALERT_TYPES];
      expect(areAllTypesSelected(newTypes)).toBe(true);
    });

    it('should clear all types', () => {
      const newTypes: AlertType[] = [];
      expect(areNoTypesSelected(newTypes)).toBe(true);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty category gracefully', () => {
    // SYSTEM only has one type
    const systemTypes = ALERT_TYPE_CATEGORIES.SYSTEM;
    expect(systemTypes).toHaveLength(1);
    expect(areCategoryTypesSelected(['SYSTEM'], 'SYSTEM')).toBe(true);
  });

  it('should handle duplicate types in selection', () => {
    const selectedTypes: AlertType[] = ['WHALE_TRADE', 'WHALE_TRADE', 'FRESH_WALLET'];
    const uniqueTypes = [...new Set(selectedTypes)];
    expect(uniqueTypes).toHaveLength(2);
  });

  it('should correctly identify mixed category selection', () => {
    const mixedTypes: AlertType[] = [
      'WHALE_TRADE', // TRADING
      'FRESH_WALLET', // WALLET
    ];

    // Should not match any single category
    expect(areCategoryTypesSelected(mixedTypes, 'TRADING')).toBe(false);
    expect(areCategoryTypesSelected(mixedTypes, 'WALLET')).toBe(false);
  });

  it('should handle type array with all but one type', () => {
    const almostAll = ALL_ALERT_TYPES.filter((t) => t !== 'SYSTEM');
    expect(areAllTypesSelected(almostAll)).toBe(false);
    expect(almostAll).toHaveLength(11);
  });

  it('should correctly calculate label for 11 types', () => {
    const almostAll = ALL_ALERT_TYPES.filter((t) => t !== 'SYSTEM');
    expect(getSelectedTypesLabel(almostAll)).toBe('11 types');
  });
});
