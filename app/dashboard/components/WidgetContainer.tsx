'use client';

import { ReactNode, useState } from 'react';

export interface WidgetContainerProps {
  title: string;
  children: ReactNode;
  testId?: string;
  className?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  actions?: ReactNode;
}

function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-3" data-testid="widget-skeleton">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
    </div>
  );
}

export default function WidgetContainer({
  title,
  children,
  testId,
  className = '',
  isLoading = false,
  onRefresh,
  actions,
}: WidgetContainerProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
      data-testid={testId}
    >
      {/* Widget Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white" data-testid="widget-title">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {actions}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              data-testid="widget-refresh-button"
              aria-label="Refresh widget"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="p-4" data-testid="widget-content">
        {isLoading || isRefreshing ? <WidgetSkeleton /> : children}
      </div>
    </div>
  );
}
