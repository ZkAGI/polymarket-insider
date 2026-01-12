'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from './components/DashboardLayout';
import WidgetContainer from './components/WidgetContainer';
import { DashboardSkeleton } from './components/DashboardSkeleton';

export interface DashboardStats {
  activeAlerts: number;
  suspiciousWallets: number;
  hotMarkets: number;
  recentTrades: number;
  systemStatus: 'connected' | 'disconnected' | 'connecting';
}

const initialStats: DashboardStats = {
  activeAlerts: 0,
  suspiciousWallets: 0,
  hotMarkets: 0,
  recentTrades: 0,
  systemStatus: 'connecting',
};

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(initialStats);

  useEffect(() => {
    // Simulate initial data load
    const loadDashboard = async () => {
      try {
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Set mock initial data
        setStats({
          activeAlerts: 12,
          suspiciousWallets: 5,
          hotMarkets: 8,
          recentTrades: 156,
          systemStatus: 'connected',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <DashboardLayout stats={stats}>
      {/* Row 1: Alert Feed and Active Signals */}
      <div className="lg:col-span-2">
        <WidgetContainer
          title="Real-time Alert Feed"
          testId="alert-feed-widget"
          className="h-full min-h-[300px]"
        >
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Alert feed will display real-time alerts here
          </div>
        </WidgetContainer>
      </div>

      <div className="lg:col-span-1">
        <WidgetContainer
          title="Active Signals"
          testId="active-signals-widget"
          className="h-full min-h-[300px]"
        >
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Signal counters will be displayed here
          </div>
        </WidgetContainer>
      </div>

      {/* Row 2: Top Suspicious Wallets and Hot Markets */}
      <div className="lg:col-span-1">
        <WidgetContainer
          title="Top Suspicious Wallets"
          testId="suspicious-wallets-widget"
          className="h-full min-h-[250px]"
        >
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Wallet rankings will be displayed here
          </div>
        </WidgetContainer>
      </div>

      <div className="lg:col-span-1">
        <WidgetContainer
          title="Hot Markets"
          testId="hot-markets-widget"
          className="h-full min-h-[250px]"
        >
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Markets with suspicious activity will be displayed here
          </div>
        </WidgetContainer>
      </div>

      <div className="lg:col-span-1">
        <WidgetContainer
          title="Recent Large Trades"
          testId="large-trades-widget"
          className="h-full min-h-[250px]"
        >
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Whale trades will be displayed here
          </div>
        </WidgetContainer>
      </div>
    </DashboardLayout>
  );
}
