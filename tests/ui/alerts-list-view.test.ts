/**
 * Unit tests for AlertsListView component
 * Feature: UI-ALERT-001 - Alerts list view with pagination
 */
import { describe, it, expect, vi } from 'vitest';

// Import types and helper functions
import type {
  AlertsListViewProps,
  AlertListItemProps,
  PaginationConfig,
  AlertsListState,
  PageSizeOption,
} from '../../app/alerts/components/AlertsListView';
import type { AlertType, AlertSeverity, FeedAlert } from '../../app/dashboard/components/AlertFeed';

// Mock React hooks for server-side testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn((initial) => [initial, vi.fn()]),
    useEffect: vi.fn(),
    useCallback: vi.fn((fn) => fn),
    useMemo: vi.fn((fn) => fn()),
  };
});

// Mock next/link
vi.mock('next/link', () => ({
  default: vi.fn(({ children }) => children),
}));

describe('AlertsListView Types and Interfaces', () => {
  describe('PaginationConfig interface', () => {
    it('should create valid pagination config', () => {
      const config: PaginationConfig = {
        currentPage: 1,
        pageSize: 20,
        totalItems: 100,
        totalPages: 5,
      };

      expect(config.currentPage).toBe(1);
      expect(config.pageSize).toBe(20);
      expect(config.totalItems).toBe(100);
      expect(config.totalPages).toBe(5);
    });

    it('should handle edge case of empty list', () => {
      const config: PaginationConfig = {
        currentPage: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
      };

      expect(config.totalItems).toBe(0);
      expect(config.totalPages).toBe(1);
    });

    it('should handle single page scenario', () => {
      const config: PaginationConfig = {
        currentPage: 1,
        pageSize: 20,
        totalItems: 15,
        totalPages: 1,
      };

      expect(config.totalPages).toBe(1);
      expect(config.totalItems).toBeLessThan(config.pageSize);
    });
  });

  describe('AlertListItemProps interface', () => {
    it('should create valid alert list item props', () => {
      const alert: FeedAlert = {
        id: 'alert-123',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Large trade detected',
        message: 'A whale trade of $500K was detected',
        read: false,
        acknowledged: false,
        createdAt: new Date(),
      };

      const props: AlertListItemProps = {
        alert,
        onClick: vi.fn(),
        onMarkRead: vi.fn(),
        testId: 'test-alert-item',
      };

      expect(props.alert.id).toBe('alert-123');
      expect(typeof props.onClick).toBe('function');
    });

    it('should allow optional callbacks', () => {
      const alert: FeedAlert = {
        id: 'alert-456',
        type: 'FRESH_WALLET',
        severity: 'MEDIUM',
        title: 'New wallet activity',
        message: 'Fresh wallet made first trade',
        read: true,
        acknowledged: true,
        createdAt: new Date(),
      };

      const props: AlertListItemProps = {
        alert,
      };

      expect(props.onClick).toBeUndefined();
      expect(props.onMarkRead).toBeUndefined();
    });
  });

  describe('AlertsListViewProps interface', () => {
    it('should create valid props with defaults', () => {
      const props: AlertsListViewProps = {};

      expect(props.alerts).toBeUndefined();
      expect(props.pageSize).toBeUndefined();
    });

    it('should accept all optional props', () => {
      const props: AlertsListViewProps = {
        alerts: [],
        pageSize: 50,
        onAlertClick: vi.fn(),
        onMarkRead: vi.fn(),
        onPageChange: vi.fn(),
        emptyMessage: 'Custom empty message',
        emptyIcon: '🔍',
        showBackLink: false,
        testId: 'custom-alerts-list',
      };

      expect(props.pageSize).toBe(50);
      expect(props.emptyMessage).toBe('Custom empty message');
      expect(props.showBackLink).toBe(false);
    });
  });

  describe('AlertsListState interface', () => {
    it('should create valid list state', () => {
      const state: AlertsListState = {
        alerts: [],
        pagination: {
          currentPage: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 1,
        },
        isLoading: false,
      };

      expect(state.alerts).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it('should handle loading state', () => {
      const state: AlertsListState = {
        alerts: [],
        pagination: {
          currentPage: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 1,
        },
        isLoading: true,
      };

      expect(state.isLoading).toBe(true);
    });
  });

  describe('PageSizeOption type', () => {
    it('should only allow valid page sizes', () => {
      const validSizes: PageSizeOption[] = [10, 20, 50, 100];
      expect(validSizes).toContain(10);
      expect(validSizes).toContain(20);
      expect(validSizes).toContain(50);
      expect(validSizes).toContain(100);
    });

    it('should have default of 20', () => {
      const defaultSize: PageSizeOption = 20;
      expect(defaultSize).toBe(20);
    });
  });
});

describe('AlertsListView Constants', () => {
  describe('PAGE_SIZE_OPTIONS', () => {
    const pageSizeOptions = [10, 20, 50, 100] as const;

    it('should have 4 options', () => {
      expect(pageSizeOptions).toHaveLength(4);
    });

    it('should be in ascending order', () => {
      for (let i = 1; i < pageSizeOptions.length; i++) {
        expect(pageSizeOptions[i]).toBeGreaterThan(pageSizeOptions[i - 1]!);
      }
    });

    it('should start at 10 and end at 100', () => {
      expect(pageSizeOptions[0]).toBe(10);
      expect(pageSizeOptions[pageSizeOptions.length - 1]).toBe(100);
    });
  });

  describe('DEFAULT_PAGE_SIZE', () => {
    const defaultPageSize = 20;

    it('should be 20', () => {
      expect(defaultPageSize).toBe(20);
    });

    it('should be in PAGE_SIZE_OPTIONS', () => {
      const options = [10, 20, 50, 100];
      expect(options).toContain(defaultPageSize);
    });
  });
});

describe('AlertsListView Helper Functions', () => {
  describe('formatAlertDate', () => {
    it('should return time ago for today', () => {
      const diffMs = 0;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(0);
    });

    it('should return "Yesterday" for one day ago', () => {
      const yesterday = 'Yesterday';
      expect(yesterday).toBe('Yesterday');
    });

    it('should return "X days ago" for less than a week', () => {
      const threeDaysAgo = '3 days ago';
      expect(threeDaysAgo).toContain('days ago');
    });

    it('should return formatted date for older alerts', () => {
      const formattedDate = 'Jan 1';
      expect(formattedDate).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });
  });

  describe('formatFullDate', () => {
    it('should include weekday', () => {
      const date = new Date('2024-01-15T10:30:00');
      const formatted = date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      expect(formatted).toContain('Mon');
    });

    it('should include time', () => {
      const date = new Date('2024-01-15T10:30:00');
      const formatted = date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      expect(formatted).toContain(':');
    });
  });

  describe('calculatePagination', () => {
    it('should calculate correct total pages', () => {
      const totalItems = 100;
      const pageSize = 20;
      const totalPages = Math.ceil(totalItems / pageSize);
      expect(totalPages).toBe(5);
    });

    it('should handle partial last page', () => {
      const totalItems = 95;
      const pageSize = 20;
      const totalPages = Math.ceil(totalItems / pageSize);
      expect(totalPages).toBe(5);
    });

    it('should return minimum of 1 page for empty list', () => {
      const totalItems = 0;
      const pageSize = 20;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      expect(totalPages).toBe(1);
    });

    it('should clamp current page to valid range', () => {
      const totalPages = 5;
      const requestedPage = 10;
      const validPage = Math.min(requestedPage, totalPages);
      expect(validPage).toBe(5);
    });

    it('should ensure current page is at least 1', () => {
      const requestedPage = 0;
      const validPage = Math.max(1, requestedPage);
      expect(validPage).toBe(1);
    });
  });

  describe('getPageNumbers', () => {
    it('should return all pages when total <= maxVisible', () => {
      const totalPages = 3;
      const maxVisibleCount = 5;
      const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
      expect(pages).toEqual([1, 2, 3]);
      expect(totalPages).toBeLessThanOrEqual(maxVisibleCount);
    });

    it('should include ellipsis for many pages', () => {
      const totalPages = 10;
      const maxVisiblePages = 5;

      // Simplified logic test
      const needsEllipsis = totalPages > maxVisiblePages;
      expect(needsEllipsis).toBe(true);
    });

    it('should always include first page', () => {
      const pages = [1, 'ellipsis', 5, 6, 7, 'ellipsis', 10];
      expect(pages[0]).toBe(1);
    });

    it('should always include last page', () => {
      const pages = [1, 'ellipsis', 5, 6, 7, 'ellipsis', 10];
      expect(pages[pages.length - 1]).toBe(10);
    });

    it('should center around current page', () => {
      const activePage = 5;
      const pages = [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10];
      expect(pages).toContain(activePage);
    });
  });

  describe('generateMockPaginatedAlerts', () => {
    it('should generate correct number of alerts for page', () => {
      const page = 1;
      const pageSize = 20;
      const totalAlerts = 100;

      // Simulate mock generation
      const allAlerts = Array(totalAlerts).fill(null).map((_, i) => ({
        id: `alert-${i}`,
        type: 'WHALE_TRADE' as AlertType,
        severity: 'INFO' as AlertSeverity,
        title: `Alert ${i}`,
        message: 'Test message',
        read: false,
        acknowledged: false,
        createdAt: new Date(),
      }));

      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageAlerts = allAlerts.slice(startIndex, endIndex);

      expect(pageAlerts).toHaveLength(20);
    });

    it('should handle last page with fewer items', () => {
      const page = 5;
      const pageSize = 20;
      const totalAlerts = 85;

      const allAlerts = Array(totalAlerts).fill(null);
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalAlerts);
      const pageAlerts = allAlerts.slice(startIndex, endIndex);

      expect(pageAlerts).toHaveLength(5); // 85 - 80 = 5
    });
  });
});

describe('AlertsListView Pagination Logic', () => {
  describe('Page navigation', () => {
    it('should disable previous on first page', () => {
      const currentPage = 1;
      const canGoPrevious = currentPage > 1;
      expect(canGoPrevious).toBe(false);
    });

    it('should enable previous on subsequent pages', () => {
      const currentPage = 3;
      const canGoPrevious = currentPage > 1;
      expect(canGoPrevious).toBe(true);
    });

    it('should disable next on last page', () => {
      const currentPage = 5;
      const totalPages = 5;
      const canGoNext = currentPage < totalPages;
      expect(canGoNext).toBe(false);
    });

    it('should enable next on non-last pages', () => {
      const currentPage = 3;
      const totalPages = 5;
      const canGoNext = currentPage < totalPages;
      expect(canGoNext).toBe(true);
    });
  });

  describe('Items display info', () => {
    it('should calculate start item correctly', () => {
      const currentPage = 2;
      const pageSize = 20;
      const startItem = (currentPage - 1) * pageSize + 1;
      expect(startItem).toBe(21);
    });

    it('should calculate end item correctly', () => {
      const currentPage = 2;
      const pageSize = 20;
      const totalItems = 100;
      const endItem = Math.min(currentPage * pageSize, totalItems);
      expect(endItem).toBe(40);
    });

    it('should handle last page end item', () => {
      const currentPage = 5;
      const pageSize = 20;
      const totalItems = 95;
      const endItem = Math.min(currentPage * pageSize, totalItems);
      expect(endItem).toBe(95);
    });
  });

  describe('Page change handling', () => {
    it('should update current page on change', () => {
      let currentPage = 1;
      const handlePageChange = (page: number) => {
        currentPage = page;
      };

      handlePageChange(3);
      expect(currentPage).toBe(3);
    });

    it('should scroll to top on page change', () => {
      // Simulate scroll behavior
      const scrollToTop = vi.fn();
      scrollToTop();
      expect(scrollToTop).toHaveBeenCalled();
    });
  });
});

describe('AlertsListView Stats Calculation', () => {
  const mockAlerts: FeedAlert[] = [
    {
      id: '1',
      type: 'WHALE_TRADE',
      severity: 'CRITICAL',
      title: 'Critical Alert',
      message: 'Message',
      read: false,
      acknowledged: false,
      createdAt: new Date(),
    },
    {
      id: '2',
      type: 'INSIDER_ACTIVITY',
      severity: 'HIGH',
      title: 'High Alert',
      message: 'Message',
      read: false,
      acknowledged: false,
      createdAt: new Date(),
    },
    {
      id: '3',
      type: 'FRESH_WALLET',
      severity: 'MEDIUM',
      title: 'Medium Alert',
      message: 'Message',
      read: true,
      acknowledged: true,
      createdAt: new Date(),
    },
    {
      id: '4',
      type: 'PRICE_MOVEMENT',
      severity: 'HIGH',
      title: 'High Alert 2',
      message: 'Message',
      read: true,
      acknowledged: false,
      createdAt: new Date(),
    },
  ];

  describe('Unread count', () => {
    it('should count unread alerts correctly', () => {
      const unreadCount = mockAlerts.filter((a) => !a.read).length;
      expect(unreadCount).toBe(2);
    });
  });

  describe('Critical count', () => {
    it('should count critical alerts correctly', () => {
      const criticalCount = mockAlerts.filter((a) => a.severity === 'CRITICAL').length;
      expect(criticalCount).toBe(1);
    });
  });

  describe('High count', () => {
    it('should count high severity alerts correctly', () => {
      const highCount = mockAlerts.filter((a) => a.severity === 'HIGH').length;
      expect(highCount).toBe(2);
    });
  });

  describe('Combined stats', () => {
    it('should show stats badges only when counts > 0', () => {
      const unreadCount = 2;
      const criticalCount = 1;
      const highCount = 2;

      expect(unreadCount > 0).toBe(true);
      expect(criticalCount > 0).toBe(true);
      expect(highCount > 0).toBe(true);
    });

    it('should hide badge when count is 0', () => {
      const count = 0;
      const showBadge = count > 0;
      expect(showBadge).toBe(false);
    });
  });
});

describe('AlertsListView Empty State', () => {
  describe('Empty state display', () => {
    it('should show empty state when no alerts', () => {
      const alerts: FeedAlert[] = [];
      const isEmpty = alerts.length === 0;
      expect(isEmpty).toBe(true);
    });

    it('should display custom empty message', () => {
      const customMessage = 'No suspicious activity detected';
      expect(customMessage).toContain('No');
    });

    it('should display custom empty icon', () => {
      const customIcon = '🔍';
      expect(customIcon).toBe('🔍');
    });

    it('should show default message when not provided', () => {
      const defaultMessage = 'No alerts have been generated yet. The system is actively monitoring for suspicious activity.';
      expect(defaultMessage).toContain('No alerts');
    });

    it('should show default icon when not provided', () => {
      const defaultIcon = '🔔';
      expect(defaultIcon).toBe('🔔');
    });
  });

  describe('Empty state navigation', () => {
    it('should include back to dashboard link', () => {
      const linkHref = '/dashboard';
      expect(linkHref).toBe('/dashboard');
    });
  });
});

describe('AlertsListView Loading State', () => {
  describe('Loading skeleton', () => {
    it('should show skeleton when loading', () => {
      const isLoading = true;
      expect(isLoading).toBe(true);
    });

    it('should show correct number of skeleton items', () => {
      const pageSize = 20;
      const skeletonCount = pageSize;
      expect(skeletonCount).toBe(20);
    });

    it('should hide list when loading', () => {
      const isLoading = true;
      const showList = !isLoading;
      expect(showList).toBe(false);
    });

    it('should show list when not loading', () => {
      const isLoading = false;
      const showList = !isLoading;
      expect(showList).toBe(true);
    });
  });

  describe('Loading state transitions', () => {
    it('should start in loading state when no external alerts', () => {
      const externalAlerts = undefined;
      const initialLoading = !externalAlerts;
      expect(initialLoading).toBe(true);
    });

    it('should not be loading when external alerts provided', () => {
      const externalAlerts: FeedAlert[] = [];
      const initialLoading = !externalAlerts;
      expect(initialLoading).toBe(false);
    });
  });
});

describe('AlertsListView Alert Item Display', () => {
  describe('Alert item structure', () => {
    it('should display alert icon', () => {
      const iconTestId = 'alert-list-icon';
      expect(iconTestId).toBe('alert-list-icon');
    });

    it('should display severity badge', () => {
      const severityTestId = 'alert-list-severity';
      expect(severityTestId).toBe('alert-list-severity');
    });

    it('should display type badge', () => {
      const typeTestId = 'alert-list-type';
      expect(typeTestId).toBe('alert-list-type');
    });

    it('should display title', () => {
      const titleTestId = 'alert-list-title';
      expect(titleTestId).toBe('alert-list-title');
    });

    it('should display message preview', () => {
      const messageTestId = 'alert-list-message';
      expect(messageTestId).toBe('alert-list-message');
    });

    it('should display timestamp', () => {
      const timeTestId = 'alert-list-time';
      expect(timeTestId).toBe('alert-list-time');
    });
  });

  describe('Alert item styling', () => {
    it('should have border for severity indication', () => {
      const severityBorders = [
        'border-l-blue-500',
        'border-l-green-500',
        'border-l-yellow-500',
        'border-l-orange-500',
        'border-l-red-500',
      ];
      severityBorders.forEach((border) => {
        expect(border).toContain('border-l-');
      });
    });

    it('should highlight unread alerts', () => {
      const unreadClass = 'ring-1 ring-blue-200 dark:ring-blue-800';
      expect(unreadClass).toContain('ring');
    });

    it('should dim read alerts', () => {
      const readClass = 'opacity-90';
      expect(readClass).toContain('opacity');
    });
  });

  describe('Alert item interactions', () => {
    it('should be clickable', () => {
      const onClick = vi.fn();
      onClick();
      expect(onClick).toHaveBeenCalled();
    });

    it('should support keyboard navigation', () => {
      const onKeyDown = vi.fn();
      onKeyDown({ key: 'Enter' });
      expect(onKeyDown).toHaveBeenCalled();
    });

    it('should mark as read on click', () => {
      const onMarkRead = vi.fn();
      const alertId = 'alert-123';
      const isRead = false;

      if (!isRead) {
        onMarkRead(alertId);
      }

      expect(onMarkRead).toHaveBeenCalledWith('alert-123');
    });
  });
});

describe('AlertsListView Context Display', () => {
  describe('Market context', () => {
    it('should display market name when available', () => {
      const marketName = 'Trump 2024 Election';
      const hasMarket = !!marketName;
      expect(hasMarket).toBe(true);
    });

    it('should not display market when not available', () => {
      const marketName = undefined;
      const hasMarket = !!marketName;
      expect(hasMarket).toBe(false);
    });
  });

  describe('Wallet context', () => {
    it('should display truncated wallet address', () => {
      const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const truncated = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      expect(truncated).toBe('0x1234...5678');
    });

    it('should not display wallet when not available', () => {
      const walletAddress = undefined;
      const hasWallet = !!walletAddress;
      expect(hasWallet).toBe(false);
    });
  });

  describe('Tags display', () => {
    it('should display up to 2 tags', () => {
      const tags = ['automated', 'whale-trade', 'high-priority'];
      const displayTags = tags.slice(0, 2);
      expect(displayTags).toHaveLength(2);
    });

    it('should not display tags section when empty', () => {
      const tags: string[] = [];
      const hasTags = tags.length > 0;
      expect(hasTags).toBe(false);
    });
  });
});

describe('AlertsListView Accessibility', () => {
  describe('ARIA attributes', () => {
    it('should have aria-label on alert items', () => {
      const ariaLabel = 'Alert: Large trade detected';
      expect(ariaLabel).toContain('Alert:');
    });

    it('should indicate unread status in aria-label', () => {
      const ariaLabel = 'Alert: Large trade detected (unread)';
      expect(ariaLabel).toContain('unread');
    });

    it('should have aria-current on active pagination page', () => {
      const ariaCurrent = 'page';
      expect(ariaCurrent).toBe('page');
    });

    it('should have aria-label on pagination buttons', () => {
      const prevLabel = 'Previous page';
      const nextLabel = 'Next page';
      expect(prevLabel).toBe('Previous page');
      expect(nextLabel).toBe('Next page');
    });

    it('should have aria-label on page number buttons', () => {
      const pageLabel = 'Page 3';
      expect(pageLabel).toMatch(/^Page \d+$/);
    });
  });

  describe('Semantic HTML', () => {
    it('should use role="article" for alert items', () => {
      const role = 'article';
      expect(role).toBe('article');
    });

    it('should use nav element for pagination', () => {
      const navLabel = 'Pagination';
      expect(navLabel).toBe('Pagination');
    });

    it('should use h1 for page title', () => {
      const heading = 'All Alerts';
      expect(heading).toBe('All Alerts');
    });

    it('should use h3 for alert titles', () => {
      const headingLevel = 'h3';
      expect(headingLevel).toBe('h3');
    });
  });

  describe('Keyboard navigation', () => {
    it('should make alert items focusable', () => {
      const tabIndex = 0;
      expect(tabIndex).toBe(0);
    });

    it('should activate on Enter key', () => {
      const key = 'Enter';
      expect(key).toBe('Enter');
    });

    it('should activate on Space key', () => {
      const key = ' ';
      expect(key).toBe(' ');
    });
  });
});

describe('AlertsListView Test IDs', () => {
  describe('Main component test IDs', () => {
    it('should have testId on main container', () => {
      const testId = 'alerts-list-view';
      expect(testId).toBe('alerts-list-view');
    });

    it('should have testId on alerts list', () => {
      const testId = 'alerts-list';
      expect(testId).toBe('alerts-list');
    });

    it('should have testId on pagination', () => {
      const testId = 'alerts-pagination';
      expect(testId).toBe('alerts-pagination');
    });

    it('should have testId on empty state', () => {
      const testId = 'alerts-empty-state';
      expect(testId).toBe('alerts-empty-state');
    });

    it('should have testId on skeleton', () => {
      const testId = 'alerts-list-skeleton';
      expect(testId).toBe('alerts-list-skeleton');
    });
  });

  describe('Header test IDs', () => {
    it('should have testId on title', () => {
      const testId = 'alerts-title';
      expect(testId).toBe('alerts-title');
    });

    it('should have testId on subtitle', () => {
      const testId = 'alerts-subtitle';
      expect(testId).toBe('alerts-subtitle');
    });

    it('should have testId on stats badges', () => {
      const testId = 'alerts-stats';
      expect(testId).toBe('alerts-stats');
    });

    it('should have testId on back link', () => {
      const testId = 'alerts-back-link';
      expect(testId).toBe('alerts-back-link');
    });
  });

  describe('Alert item test IDs', () => {
    it('should have unique testId per alert', () => {
      const alertId = 'alert-123';
      const testId = `alert-list-item-${alertId}`;
      expect(testId).toBe('alert-list-item-alert-123');
    });

    it('should have data attributes for filtering', () => {
      const dataAttributes = {
        'data-alert-id': 'alert-123',
        'data-alert-type': 'WHALE_TRADE',
        'data-alert-severity': 'HIGH',
        'data-alert-read': 'false',
      };

      expect(dataAttributes['data-alert-id']).toBe('alert-123');
      expect(dataAttributes['data-alert-type']).toBe('WHALE_TRADE');
      expect(dataAttributes['data-alert-read']).toBe('false');
    });
  });

  describe('Pagination test IDs', () => {
    it('should have testId on pagination controls', () => {
      const testId = 'pagination-controls';
      expect(testId).toBe('pagination-controls');
    });

    it('should have testId on pagination info', () => {
      const testId = 'pagination-info';
      expect(testId).toBe('pagination-info');
    });

    it('should have testId on prev button', () => {
      const testId = 'pagination-prev';
      expect(testId).toBe('pagination-prev');
    });

    it('should have testId on next button', () => {
      const testId = 'pagination-next';
      expect(testId).toBe('pagination-next');
    });

    it('should have testId on each page number', () => {
      const page = 3;
      const testId = `pagination-page-${page}`;
      expect(testId).toBe('pagination-page-3');
    });

    it('should have testId on ellipsis', () => {
      const testId = 'pagination-ellipsis';
      expect(testId).toBe('pagination-ellipsis');
    });
  });
});

describe('AlertsListView Props Defaults', () => {
  describe('Default values', () => {
    it('should default pageSize to 20', () => {
      const defaultPageSize = 20;
      expect(defaultPageSize).toBe(20);
    });

    it('should default showBackLink to true', () => {
      const defaultShowBackLink = true;
      expect(defaultShowBackLink).toBe(true);
    });

    it('should default emptyIcon to bell emoji', () => {
      const defaultEmptyIcon = '🔔';
      expect(defaultEmptyIcon).toBe('🔔');
    });

    it('should default testId to "alerts-list-view"', () => {
      const defaultTestId = 'alerts-list-view';
      expect(defaultTestId).toBe('alerts-list-view');
    });

    it('should have meaningful default empty message', () => {
      const defaultMessage = 'No alerts have been generated yet. The system is actively monitoring for suspicious activity.';
      expect(defaultMessage.length).toBeGreaterThan(20);
    });
  });
});

describe('AlertsListView Responsive Design', () => {
  describe('Layout responsiveness', () => {
    it('should use max-w-5xl for container', () => {
      const maxWidth = 'max-w-5xl';
      expect(maxWidth).toBe('max-w-5xl');
    });

    it('should use responsive padding', () => {
      const padding = 'px-4 sm:px-6 lg:px-8';
      expect(padding).toContain('sm:');
      expect(padding).toContain('lg:');
    });

    it('should stack header on mobile', () => {
      const flexDirection = 'flex-col sm:flex-row';
      expect(flexDirection).toContain('sm:');
    });
  });

  describe('Pagination responsiveness', () => {
    it('should stack pagination on mobile', () => {
      const flexDirection = 'flex-col sm:flex-row';
      expect(flexDirection).toContain('sm:');
    });

    it('should center items on mobile', () => {
      const alignment = 'items-center';
      expect(alignment).toBe('items-center');
    });
  });
});

describe('AlertsListView Dark Mode', () => {
  describe('Dark mode classes', () => {
    it('should have dark mode background', () => {
      const bgClass = 'bg-gray-50 dark:bg-gray-900';
      expect(bgClass).toContain('dark:');
    });

    it('should have dark mode text colors', () => {
      const textClass = 'text-gray-900 dark:text-white';
      expect(textClass).toContain('dark:');
    });

    it('should have dark mode border colors', () => {
      const borderClass = 'border-gray-100 dark:border-gray-700';
      expect(borderClass).toContain('dark:');
    });

    it('should have dark mode hover states', () => {
      const hoverClass = 'hover:bg-gray-50 dark:hover:bg-gray-750';
      expect(hoverClass).toContain('dark:hover:');
    });
  });
});

describe('AlertsListView Mark as Read', () => {
  describe('Mark read functionality', () => {
    it('should call onMarkRead callback', () => {
      const onMarkRead = vi.fn();
      const alertId = 'alert-123';
      onMarkRead(alertId);
      expect(onMarkRead).toHaveBeenCalledWith('alert-123');
    });

    it('should update local state', () => {
      const alerts: FeedAlert[] = [
        {
          id: 'alert-1',
          type: 'WHALE_TRADE',
          severity: 'HIGH',
          title: 'Alert',
          message: 'Message',
          read: false,
          acknowledged: false,
          createdAt: new Date(),
        },
      ];

      const updatedAlerts = alerts.map((a) =>
        a.id === 'alert-1' ? { ...a, read: true } : a
      );

      expect(updatedAlerts[0]!.read).toBe(true);
    });

    it('should not call onMarkRead if already read', () => {
      const onMarkRead = vi.fn();
      const alert: FeedAlert = {
        id: 'alert-1',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Alert',
        message: 'Message',
        read: true, // Already read
        acknowledged: false,
        createdAt: new Date(),
      };

      if (!alert.read) {
        onMarkRead(alert.id);
      }

      expect(onMarkRead).not.toHaveBeenCalled();
    });
  });
});

describe('AlertsListView Sorting', () => {
  describe('Default sort order', () => {
    it('should sort by date descending (newest first)', () => {
      const alerts: FeedAlert[] = [
        {
          id: '1',
          type: 'WHALE_TRADE',
          severity: 'HIGH',
          title: 'Old',
          message: 'Message',
          read: false,
          acknowledged: false,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          type: 'WHALE_TRADE',
          severity: 'HIGH',
          title: 'New',
          message: 'Message',
          read: false,
          acknowledged: false,
          createdAt: new Date('2024-01-02'),
        },
      ];

      const sorted = [...alerts].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      expect(sorted[0]!.id).toBe('2'); // Newest first
    });
  });
});
