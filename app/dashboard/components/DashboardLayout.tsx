'use client';

import { ReactNode } from 'react';
import type { DashboardStats } from '../page';

export interface DashboardLayoutProps {
  children: ReactNode;
  stats: DashboardStats;
}

function StatusIndicator({ status }: { status: DashboardStats['systemStatus'] }) {
  const statusColors = {
    connected: 'bg-green-500',
    disconnected: 'bg-red-500',
    connecting: 'bg-yellow-500 animate-pulse',
  };

  const statusLabels = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
  };

  return (
    <div className="flex items-center gap-2" data-testid="system-status">
      <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      <span className="text-sm text-gray-600 dark:text-gray-300">{statusLabels[status]}</span>
    </div>
  );
}

function QuickStat({
  label,
  value,
  testId,
}: {
  label: string;
  value: number | string;
  testId: string;
}) {
  return (
    <div className="flex flex-col" data-testid={testId}>
      <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

export default function DashboardLayout({ children, stats }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="dashboard-layout">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Polymarket Tracker
              </h1>
              <span className="text-sm text-gray-500 dark:text-gray-400">Dashboard</span>
            </div>
            <StatusIndicator status={stats.systemStatus} />
          </div>
        </div>
      </header>

      {/* Quick Stats Bar */}
      <div
        className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        data-testid="stats-bar"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            <QuickStat label="Active Alerts" value={stats.activeAlerts} testId="stat-active-alerts" />
            <QuickStat
              label="Suspicious Wallets"
              value={stats.suspiciousWallets}
              testId="stat-suspicious-wallets"
            />
            <QuickStat label="Hot Markets" value={stats.hotMarkets} testId="stat-hot-markets" />
            <QuickStat label="Recent Trades" value={stats.recentTrades} testId="stat-recent-trades" />
          </div>
        </div>
      </div>

      {/* Main Content - Responsive Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid="dashboard-main">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto"
        data-testid="dashboard-footer"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Polymarket Insider/Whale Tracker</span>
            <span>Real-time monitoring active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
