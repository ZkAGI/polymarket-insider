'use client';

/**
 * Live Indicator Component (UI-WS-001)
 *
 * Visual indicator showing real-time connection status.
 * Displays "LIVE" when connected to the dashboard SSE stream.
 *
 * States:
 * - connected: Green pulsing "LIVE" indicator
 * - connecting: Yellow pulsing indicator with "Connecting..."
 * - reconnecting: Yellow indicator with "Reconnecting..."
 * - disconnected: Gray indicator with "Offline"
 */

import { memo } from 'react';
import type { ConnectionStatus } from '@/hooks/useDashboardLive';

export interface LiveIndicatorProps {
  /** Connection status */
  status: ConnectionStatus;
  /** Whether to show the status label */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Test ID for E2E testing */
  testId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Size configurations for the indicator
 */
const sizeConfig = {
  sm: {
    dot: 'w-2 h-2',
    text: 'text-xs',
    padding: 'px-2 py-0.5',
    gap: 'gap-1.5',
  },
  md: {
    dot: 'w-2.5 h-2.5',
    text: 'text-sm',
    padding: 'px-2.5 py-1',
    gap: 'gap-2',
  },
  lg: {
    dot: 'w-3 h-3',
    text: 'text-base',
    padding: 'px-3 py-1.5',
    gap: 'gap-2',
  },
};

/**
 * Status configurations for styling and labels
 */
const statusConfig: Record<
  ConnectionStatus,
  {
    dotColor: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    label: string;
    animate: boolean;
  }
> = {
  connected: {
    dotColor: 'bg-green-500',
    textColor: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'LIVE',
    animate: true,
  },
  connecting: {
    dotColor: 'bg-yellow-500',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    label: 'Connecting...',
    animate: true,
  },
  reconnecting: {
    dotColor: 'bg-yellow-500',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    label: 'Reconnecting...',
    animate: true,
  },
  disconnected: {
    dotColor: 'bg-gray-400 dark:bg-gray-500',
    textColor: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    borderColor: 'border-gray-200 dark:border-gray-700',
    label: 'Offline',
    animate: false,
  },
};

/**
 * LiveIndicator Component
 *
 * Displays real-time connection status with visual indicator.
 */
function LiveIndicator({
  status,
  showLabel = true,
  size = 'sm',
  testId = 'live-indicator',
  className = '',
  onClick,
}: LiveIndicatorProps) {
  const sizeClasses = sizeConfig[size];
  const statusClasses = statusConfig[status];

  const handleClick = () => {
    onClick?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      data-testid={testId}
      data-status={status}
      className={`
        inline-flex items-center ${sizeClasses.gap} ${sizeClasses.padding}
        rounded-full border ${statusClasses.borderColor} ${statusClasses.bgColor}
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        ${className}
      `}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Connection status: ${statusClasses.label}`}
    >
      {/* Pulsing dot indicator */}
      <span className="relative flex">
        <span
          className={`
            ${sizeClasses.dot} rounded-full ${statusClasses.dotColor}
            ${statusClasses.animate ? 'animate-pulse' : ''}
          `}
        />
        {status === 'connected' && (
          <span
            className={`
              absolute inset-0 ${sizeClasses.dot} rounded-full ${statusClasses.dotColor}
              animate-ping opacity-75
            `}
          />
        )}
      </span>

      {/* Status label */}
      {showLabel && (
        <span
          className={`${sizeClasses.text} font-medium ${statusClasses.textColor}`}
        >
          {statusClasses.label}
        </span>
      )}
    </div>
  );
}

export default memo(LiveIndicator);
