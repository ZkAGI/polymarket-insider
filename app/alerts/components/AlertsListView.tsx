'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  FeedAlert,
  AlertType,
  getAlertTypeIcon,
  getAlertTypeLabel,
  getSeverityColor,
  getSeverityBorderColor,
  formatTimeAgo,
  generateMockAlerts,
} from '../../dashboard/components/AlertFeed';
import AlertTypeFilter, {
  ActiveFilterChips,
  ALL_ALERT_TYPES,
  areAllTypesSelected,
  areNoTypesSelected,
} from './AlertTypeFilter';
import AlertSeverityFilter, {
  ActiveSeverityChips,
  ALL_SEVERITY_LEVELS,
  areAllSeveritiesSelected,
  areNoSeveritiesSelected,
} from './AlertSeverityFilter';
import type { AlertSeverity } from '../../dashboard/components/AlertFeed';

// Re-export types for external use
export type { AlertType, AlertSeverity, FeedAlert } from '../../dashboard/components/AlertFeed';

// Pagination configuration
export interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// Alert list item props
export interface AlertListItemProps {
  alert: FeedAlert;
  onClick?: (alert: FeedAlert) => void;
  onMarkRead?: (alertId: string) => void;
  testId?: string;
}

// Main component props
export interface AlertsListViewProps {
  alerts?: FeedAlert[];
  pageSize?: number;
  onAlertClick?: (alert: FeedAlert) => void;
  onMarkRead?: (alertId: string) => void;
  onPageChange?: (page: number) => void;
  onTypeFilterChange?: (types: AlertType[]) => void;
  onSeverityFilterChange?: (severities: AlertSeverity[]) => void;
  initialTypeFilters?: AlertType[];
  initialSeverityFilters?: AlertSeverity[];
  emptyMessage?: string;
  emptyIcon?: string;
  showBackLink?: boolean;
  showTypeFilter?: boolean;
  showSeverityFilter?: boolean;
  testId?: string;
}

// Pagination info returned with list
export interface AlertsListState {
  alerts: FeedAlert[];
  pagination: PaginationConfig;
  isLoading: boolean;
}

// Page size options
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

// Default page size
export const DEFAULT_PAGE_SIZE: PageSizeOption = 20;

// Format alert date for display in list
export function formatAlertDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return formatTimeAgo(date);
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  // Format as date for older alerts
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: diffDays > 365 ? 'numeric' : undefined,
  });
}

// Format full date for tooltip
export function formatFullDate(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Calculate pagination
export function calculatePagination(
  totalItems: number,
  currentPage: number,
  pageSize: number
): PaginationConfig {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

  return {
    currentPage: validCurrentPage,
    pageSize,
    totalItems,
    totalPages,
  };
}

// Get page numbers to display
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5
): (number | 'ellipsis')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const halfVisible = Math.floor(maxVisible / 2);

  // Always show first page
  pages.push(1);

  let start = Math.max(2, currentPage - halfVisible);
  let end = Math.min(totalPages - 1, currentPage + halfVisible);

  // Adjust if we're near the start
  if (currentPage <= halfVisible + 1) {
    end = Math.min(totalPages - 1, maxVisible - 1);
  }

  // Adjust if we're near the end
  if (currentPage >= totalPages - halfVisible) {
    start = Math.max(2, totalPages - maxVisible + 2);
  }

  // Add ellipsis if needed before middle pages
  if (start > 2) {
    pages.push('ellipsis');
  }

  // Add middle pages
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Add ellipsis if needed after middle pages
  if (end < totalPages - 1) {
    pages.push('ellipsis');
  }

  // Always show last page if more than one page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

// Generate mock paginated alerts
export function generateMockPaginatedAlerts(
  page: number,
  pageSize: number,
  totalAlerts: number = 100
): AlertsListState {
  // Generate a fixed set of mock alerts based on total
  const allAlerts = generateMockAlerts(totalAlerts);

  // Sort by date descending
  const sortedAlerts = allAlerts.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  // Calculate pagination
  const pagination = calculatePagination(totalAlerts, page, pageSize);

  // Get page slice
  const startIndex = (pagination.currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageAlerts = sortedAlerts.slice(startIndex, endIndex);

  return {
    alerts: pageAlerts,
    pagination,
    isLoading: false,
  };
}

// Individual alert list item component
function AlertListItem({ alert, onClick, onMarkRead, testId }: AlertListItemProps) {
  const handleClick = () => {
    onClick?.(alert);
    if (!alert.read && onMarkRead) {
      onMarkRead(alert.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`
        p-4 border-l-4 rounded-lg cursor-pointer
        bg-white dark:bg-gray-800
        hover:bg-gray-50 dark:hover:bg-gray-750
        hover:shadow-md
        transition-all duration-200 ease-in-out
        ${getSeverityBorderColor(alert.severity)}
        ${!alert.read ? 'ring-1 ring-blue-200 dark:ring-blue-800' : 'opacity-90'}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="article"
      tabIndex={0}
      aria-label={`Alert: ${alert.title}${!alert.read ? ' (unread)' : ''}`}
      data-testid={testId || `alert-list-item-${alert.id}`}
      data-alert-id={alert.id}
      data-alert-type={alert.type}
      data-alert-severity={alert.severity}
      data-alert-read={alert.read}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">
          <span
            className="text-2xl"
            role="img"
            aria-label={getAlertTypeLabel(alert.type)}
            data-testid="alert-list-icon"
          >
            {getAlertTypeIcon(alert.type)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            {/* Severity badge */}
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${getSeverityColor(alert.severity)}`}
              data-testid="alert-list-severity"
            >
              {alert.severity}
            </span>

            {/* Type badge */}
            <span
              className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              data-testid="alert-list-type"
            >
              {getAlertTypeLabel(alert.type)}
            </span>

            {/* Unread indicator */}
            {!alert.read && (
              <span
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"
                data-testid="alert-list-unread"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                New
              </span>
            )}

            {/* Tags */}
            {alert.tags && alert.tags.length > 0 && (
              <div className="flex gap-1" data-testid="alert-list-tags">
                {alert.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <h3
            className={`text-base font-medium text-gray-900 dark:text-white mb-1 ${
              !alert.read ? 'font-semibold' : ''
            }`}
            data-testid="alert-list-title"
          >
            {alert.title}
          </h3>

          {/* Message */}
          <p
            className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
            data-testid="alert-list-message"
          >
            {alert.message}
          </p>

          {/* Footer row */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            {/* Timestamp */}
            <span
              className="text-xs text-gray-500 dark:text-gray-500"
              title={formatFullDate(alert.createdAt)}
              data-testid="alert-list-time"
            >
              {formatAlertDate(alert.createdAt)}
            </span>

            {/* Context info */}
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
              {alert.marketName && (
                <span
                  className="flex items-center gap-1 truncate max-w-[150px]"
                  data-testid="alert-list-market"
                >
                  <span>📊</span>
                  {alert.marketName}
                </span>
              )}
              {alert.walletAddress && (
                <span
                  className="flex items-center gap-1 font-mono"
                  data-testid="alert-list-wallet"
                >
                  <span>👛</span>
                  {`${alert.walletAddress.slice(0, 6)}...${alert.walletAddress.slice(-4)}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action arrow */}
        <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Pagination controls component
function PaginationControls({
  pagination,
  onPageChange,
  testId,
}: {
  pagination: PaginationConfig;
  onPageChange: (page: number) => void;
  testId?: string;
}) {
  const { currentPage, totalPages, totalItems, pageSize } = pagination;
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    if (page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4"
      data-testid={testId || 'pagination-controls'}
    >
      {/* Items info */}
      <div
        className="text-sm text-gray-500 dark:text-gray-400"
        data-testid="pagination-info"
      >
        Showing{' '}
        <span className="font-medium text-gray-900 dark:text-white">{startItem}</span>
        {' '}-{' '}
        <span className="font-medium text-gray-900 dark:text-white">{endItem}</span>
        {' '}of{' '}
        <span className="font-medium text-gray-900 dark:text-white">{totalItems}</span>
        {' '}alerts
      </div>

      {/* Page controls */}
      <nav
        className="flex items-center gap-1"
        aria-label="Pagination"
        data-testid="pagination-nav"
      >
        {/* Previous button */}
        <button
          onClick={handlePrevious}
          disabled={currentPage <= 1}
          className={`
            px-3 py-2 text-sm font-medium rounded-md
            ${
              currentPage <= 1
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }
          `}
          aria-label="Previous page"
          data-testid="pagination-prev"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1" data-testid="pagination-pages">
          {pageNumbers.map((page, index) => (
            page === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 py-2 text-gray-500 dark:text-gray-400"
                data-testid="pagination-ellipsis"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => handlePageClick(page)}
                className={`
                  min-w-[40px] px-3 py-2 text-sm font-medium rounded-md
                  ${
                    page === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                aria-current={page === currentPage ? 'page' : undefined}
                aria-label={`Page ${page}`}
                data-testid={`pagination-page-${page}`}
              >
                {page}
              </button>
            )
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          className={`
            px-3 py-2 text-sm font-medium rounded-md
            ${
              currentPage >= totalPages
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }
          `}
          aria-label="Next page"
          data-testid="pagination-next"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </nav>
    </div>
  );
}

// Empty state component
function EmptyState({
  message,
  icon,
  testId,
}: {
  message: string;
  icon: string;
  testId?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid={testId || 'alerts-empty-state'}
    >
      <span className="text-6xl mb-4" role="img" aria-label="No alerts">
        {icon}
      </span>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        No Alerts Found
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
        {message}
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        data-testid="empty-back-link"
      >
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>
    </div>
  );
}

// Loading skeleton
function AlertsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4" data-testid="alerts-list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse p-4 border-l-4 border-l-gray-300 dark:border-l-gray-600 rounded-lg bg-white dark:bg-gray-800"
        >
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-1" />
              <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Main AlertsListView component
export default function AlertsListView({
  alerts: externalAlerts,
  pageSize = DEFAULT_PAGE_SIZE,
  onAlertClick,
  onMarkRead,
  onPageChange,
  onTypeFilterChange,
  onSeverityFilterChange,
  initialTypeFilters,
  initialSeverityFilters,
  emptyMessage = 'No alerts have been generated yet. The system is actively monitoring for suspicious activity.',
  emptyIcon = '🔔',
  showBackLink = true,
  showTypeFilter = true,
  showSeverityFilter = true,
  testId = 'alerts-list-view',
}: AlertsListViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [alerts, setAlerts] = useState<FeedAlert[]>(externalAlerts || []);
  const [isLoading, setIsLoading] = useState(!externalAlerts);
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<AlertType[]>(
    initialTypeFilters || [...ALL_ALERT_TYPES]
  );
  const [selectedSeverityFilters, setSelectedSeverityFilters] = useState<AlertSeverity[]>(
    initialSeverityFilters || [...ALL_SEVERITY_LEVELS]
  );

  // Update alerts when external alerts change
  useEffect(() => {
    if (externalAlerts) {
      setAlerts(externalAlerts);
      setIsLoading(false);
    }
  }, [externalAlerts]);

  // Simulate loading mock alerts when no external alerts provided
  useEffect(() => {
    if (externalAlerts) return;

    const loadMockAlerts = () => {
      // Generate a larger set of mock alerts for the full list view
      const mockAlerts = generateMockAlerts(50);
      setAlerts(mockAlerts);
      setIsLoading(false);
    };

    // Simulate loading delay
    const timer = setTimeout(loadMockAlerts, 800);
    return () => clearTimeout(timer);
  }, [externalAlerts]);

  // Filter alerts by type and severity
  const filteredAlerts = useMemo(() => {
    let result = alerts;

    // Filter by type
    const typeFilterActive = !areAllTypesSelected(selectedTypeFilters) && !areNoTypesSelected(selectedTypeFilters);
    if (typeFilterActive) {
      result = result.filter((alert) => selectedTypeFilters.includes(alert.type));
    }

    // Filter by severity
    const severityFilterActive = !areAllSeveritiesSelected(selectedSeverityFilters) && !areNoSeveritiesSelected(selectedSeverityFilters);
    if (severityFilterActive) {
      result = result.filter((alert) => selectedSeverityFilters.includes(alert.severity));
    }

    return result;
  }, [alerts, selectedTypeFilters, selectedSeverityFilters]);

  // Calculate pagination based on filtered alerts
  const pagination = useMemo(
    () => calculatePagination(filteredAlerts.length, currentPage, pageSize),
    [filteredAlerts.length, currentPage, pageSize]
  );

  // Get current page alerts from filtered list
  const paginatedAlerts = useMemo(() => {
    const startIndex = (pagination.currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAlerts.slice(startIndex, endIndex);
  }, [filteredAlerts, pagination.currentPage, pageSize]);

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      onPageChange?.(page);
      // Scroll to top of list
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [onPageChange]
  );

  // Handle alert click
  const handleAlertClick = useCallback(
    (alert: FeedAlert) => {
      onAlertClick?.(alert);
    },
    [onAlertClick]
  );

  // Handle mark as read
  const handleMarkRead = useCallback(
    (alertId: string) => {
      onMarkRead?.(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
    },
    [onMarkRead]
  );

  // Handle type filter change
  const handleTypeFilterChange = useCallback(
    (types: AlertType[]) => {
      setSelectedTypeFilters(types);
      // Reset to page 1 when filters change
      setCurrentPage(1);
      onTypeFilterChange?.(types);
    },
    [onTypeFilterChange]
  );

  // Handle removing a single type filter
  const handleRemoveTypeFilter = useCallback(
    (type: AlertType) => {
      const newTypes = selectedTypeFilters.filter((t) => t !== type);
      handleTypeFilterChange(newTypes.length > 0 ? newTypes : [...ALL_ALERT_TYPES]);
    },
    [selectedTypeFilters, handleTypeFilterChange]
  );

  // Handle clearing all type filters
  const handleClearAllTypeFilters = useCallback(() => {
    handleTypeFilterChange([...ALL_ALERT_TYPES]);
  }, [handleTypeFilterChange]);

  // Handle severity filter change
  const handleSeverityFilterChange = useCallback(
    (severities: AlertSeverity[]) => {
      setSelectedSeverityFilters(severities);
      // Reset to page 1 when filters change
      setCurrentPage(1);
      onSeverityFilterChange?.(severities);
    },
    [onSeverityFilterChange]
  );

  // Handle removing a single severity filter
  const handleRemoveSeverityFilter = useCallback(
    (severity: AlertSeverity) => {
      const newSeverities = selectedSeverityFilters.filter((s) => s !== severity);
      handleSeverityFilterChange(newSeverities.length > 0 ? newSeverities : [...ALL_SEVERITY_LEVELS]);
    },
    [selectedSeverityFilters, handleSeverityFilterChange]
  );

  // Handle clearing all severity filters
  const handleClearAllSeverityFilters = useCallback(() => {
    handleSeverityFilterChange([...ALL_SEVERITY_LEVELS]);
  }, [handleSeverityFilterChange]);

  // Handle clearing all filters (both type and severity)
  const handleClearAllFilters = useCallback(() => {
    handleTypeFilterChange([...ALL_ALERT_TYPES]);
    handleSeverityFilterChange([...ALL_SEVERITY_LEVELS]);
  }, [handleTypeFilterChange, handleSeverityFilterChange]);

  // Calculate stats from all alerts (for header display)
  const stats = useMemo(() => {
    const unreadCount = alerts.filter((a) => !a.read).length;
    const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
    const highCount = alerts.filter((a) => a.severity === 'HIGH').length;
    return { unreadCount, criticalCount, highCount };
  }, [alerts]);

  // Check if type filter is active (not showing all)
  const isTypeFilterActive = !areAllTypesSelected(selectedTypeFilters) && !areNoTypesSelected(selectedTypeFilters);

  // Check if severity filter is active (not showing all)
  const isSeverityFilterActive = !areAllSeveritiesSelected(selectedSeverityFilters) && !areNoSeveritiesSelected(selectedSeverityFilters);

  // Check if any filters are active
  const hasActiveFilters = isTypeFilterActive || isSeverityFilterActive;

  return (
    <div className="w-full" data-testid={testId}>
      {/* Header */}
      <div className="mb-6">
        {showBackLink && (
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
            data-testid="alerts-back-link"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="alerts-title">
              All Alerts
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1" data-testid="alerts-subtitle">
              View and manage all system alerts
            </p>
          </div>

          {/* Stats badges */}
          {!isLoading && alerts.length > 0 && (
            <div className="flex items-center gap-2" data-testid="alerts-stats">
              {stats.unreadCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {stats.unreadCount} unread
                </span>
              )}
              {stats.criticalCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {stats.criticalCount} critical
                </span>
              )}
              {stats.highCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  {stats.highCount} high
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filters section */}
        {(showTypeFilter || showSeverityFilter) && !isLoading && alerts.length > 0 && (
          <div className="mt-4" data-testid="alerts-filter-section">
            {/* Filter controls row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type filter */}
              {showTypeFilter && (
                <AlertTypeFilter
                  selectedTypes={selectedTypeFilters}
                  onChange={handleTypeFilterChange}
                  testId="alerts-type-filter"
                />
              )}

              {/* Severity filter */}
              {showSeverityFilter && (
                <AlertSeverityFilter
                  selectedSeverities={selectedSeverityFilters}
                  onChange={handleSeverityFilterChange}
                  testId="alerts-severity-filter"
                />
              )}

              {/* Filter results summary */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2" data-testid="alerts-filter-summary">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {filteredAlerts.length} of {alerts.length} alerts
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                    data-testid="alerts-clear-all-filters"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Active filter chips */}
            <div className="mt-3 space-y-2" data-testid="alerts-active-filter-chips">
              {/* Type filter chips */}
              {showTypeFilter && (
                <ActiveFilterChips
                  selectedTypes={selectedTypeFilters}
                  onRemove={handleRemoveTypeFilter}
                  onClearAll={handleClearAllTypeFilters}
                  testId="alerts-active-type-filters"
                />
              )}

              {/* Severity filter chips */}
              {showSeverityFilter && (
                <ActiveSeverityChips
                  selectedSeverities={selectedSeverityFilters}
                  onRemove={handleRemoveSeverityFilter}
                  onClearAll={handleClearAllSeverityFilters}
                  testId="alerts-active-severity-filters"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <AlertsListSkeleton count={pageSize} />
      ) : alerts.length === 0 ? (
        <EmptyState message={emptyMessage} icon={emptyIcon} />
      ) : filteredAlerts.length === 0 ? (
        <EmptyState
          message="No alerts match your current filters. Try adjusting or clearing your filters."
          icon="🔍"
          testId="alerts-no-filter-results"
        />
      ) : (
        <>
          {/* Alert list */}
          <div className="space-y-3" data-testid="alerts-list">
            {paginatedAlerts.map((alert) => (
              <AlertListItem
                key={alert.id}
                alert={alert}
                onClick={handleAlertClick}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <PaginationControls
              pagination={pagination}
              onPageChange={handlePageChange}
              testId="alerts-pagination"
            />
          )}
        </>
      )}
    </div>
  );
}

// Export sub-components for flexibility
export { AlertListItem, PaginationControls, EmptyState, AlertsListSkeleton };
