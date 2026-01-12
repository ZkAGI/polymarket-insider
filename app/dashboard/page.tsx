'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from './components/DashboardLayout';
import WidgetContainer from './components/WidgetContainer';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import AlertFeed, { FeedAlert, generateMockAlerts } from './components/AlertFeed';
import ActiveSignalsCounter, {
  SignalCount,
  SignalType,
  generateMockSignals,
} from './components/ActiveSignalsCounter';
import SuspiciousWalletsWidget, {
  SuspiciousWallet,
  generateMockWallets,
} from './components/SuspiciousWalletsWidget';

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
  const [alerts, setAlerts] = useState<FeedAlert[]>([]);
  const [isAlertFeedLoading, setIsAlertFeedLoading] = useState(true);
  const [signals, setSignals] = useState<SignalCount[]>([]);
  const [isSignalsLoading, setIsSignalsLoading] = useState(true);
  const [suspiciousWallets, setSuspiciousWallets] = useState<SuspiciousWallet[]>([]);
  const [isWalletsLoading, setIsWalletsLoading] = useState(true);

  // Load initial dashboard data
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Generate initial mock alerts
        const mockAlerts = generateMockAlerts(8);
        setAlerts(mockAlerts);

        // Generate initial mock signals
        const mockSignals = generateMockSignals();
        setSignals(mockSignals);

        // Generate initial mock suspicious wallets
        const mockWallets = generateMockWallets(5);
        setSuspiciousWallets(mockWallets);

        // Set mock initial data - count unread alerts
        const unreadCount = mockAlerts.filter((a) => !a.read).length;
        setStats({
          activeAlerts: unreadCount,
          suspiciousWallets: mockWallets.length,
          hotMarkets: 8,
          recentTrades: 156,
          systemStatus: 'connected',
        });
      } finally {
        setIsLoading(false);
        setIsAlertFeedLoading(false);
        setIsSignalsLoading(false);
        setIsWalletsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  // Simulate real-time alert updates
  useEffect(() => {
    if (isLoading) return;

    const addNewAlert = () => {
      const mockAlerts = generateMockAlerts(1);
      const baseAlert = mockAlerts[0];
      if (!baseAlert) return;

      const newAlert: FeedAlert = {
        ...baseAlert,
        id: `alert-${Date.now()}`,
        createdAt: new Date(),
        read: false,
        isNew: true,
      };

      setAlerts((prev) => {
        const updated = [newAlert, ...prev].slice(0, 20);
        // Update stats with new alert count
        const unreadCount = updated.filter((a) => !a.read).length;
        setStats((s) => ({ ...s, activeAlerts: unreadCount }));
        return updated;
      });
    };

    // Add a new alert every 15-30 seconds for demo
    const interval = setInterval(
      addNewAlert,
      15000 + Math.random() * 15000
    );

    return () => clearInterval(interval);
  }, [isLoading]);

  // Handle alert click
  const handleAlertClick = useCallback((alert: FeedAlert) => {
    console.log('Alert clicked:', alert);
    // In a real app, this would open a detail modal or navigate to alert details
  }, []);

  // Handle mark as read
  const handleMarkRead = useCallback((alertId: string) => {
    setAlerts((prev) => {
      const updated = prev.map((a) =>
        a.id === alertId ? { ...a, read: true } : a
      );
      // Update stats with new unread count
      const unreadCount = updated.filter((a) => !a.read).length;
      setStats((s) => ({ ...s, activeAlerts: unreadCount }));
      return updated;
    });
  }, []);

  // Handle refresh alerts
  const handleRefreshAlerts = useCallback(async () => {
    setIsAlertFeedLoading(true);
    try {
      // Simulate API fetch
      await new Promise((resolve) => setTimeout(resolve, 500));
      const newAlerts = generateMockAlerts(8);
      setAlerts(newAlerts);
      const unreadCount = newAlerts.filter((a) => !a.read).length;
      setStats((s) => ({ ...s, activeAlerts: unreadCount }));
    } finally {
      setIsAlertFeedLoading(false);
    }
  }, []);

  // Handle signal click
  const handleSignalClick = useCallback((signalType: SignalType) => {
    console.log('Signal clicked:', signalType);
    // In a real app, this would filter alerts or navigate to signal details
  }, []);

  // Handle refresh signals
  const handleRefreshSignals = useCallback(async () => {
    setIsSignalsLoading(true);
    try {
      // Simulate API fetch
      await new Promise((resolve) => setTimeout(resolve, 500));
      const newSignals = generateMockSignals();
      setSignals(newSignals);
    } finally {
      setIsSignalsLoading(false);
    }
  }, []);

  // Handle wallet click
  const handleWalletClick = useCallback((wallet: SuspiciousWallet) => {
    console.log('Wallet clicked:', wallet);
    // In a real app, this would navigate to wallet details
  }, []);

  // Handle wallet watch toggle
  const handleWatchToggle = useCallback((walletId: string) => {
    setSuspiciousWallets((prev) =>
      prev.map((w) =>
        w.id === walletId ? { ...w, isWatched: !w.isWatched } : w
      )
    );
  }, []);

  // Handle refresh wallets
  const handleRefreshWallets = useCallback(async () => {
    setIsWalletsLoading(true);
    try {
      // Simulate API fetch
      await new Promise((resolve) => setTimeout(resolve, 500));
      const newWallets = generateMockWallets(5);
      setSuspiciousWallets(newWallets);
      setStats((s) => ({ ...s, suspiciousWallets: newWallets.length }));
    } finally {
      setIsWalletsLoading(false);
    }
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
          onRefresh={handleRefreshAlerts}
          isLoading={isAlertFeedLoading}
        >
          <AlertFeed
            alerts={alerts}
            maxAlerts={20}
            onAlertClick={handleAlertClick}
            onMarkRead={handleMarkRead}
            emptyMessage="No alerts detected. The system is monitoring for suspicious activity."
            testId="alert-feed-content"
          />
        </WidgetContainer>
      </div>

      <div className="lg:col-span-1">
        <WidgetContainer
          title="Active Signals"
          testId="active-signals-widget"
          className="h-full min-h-[300px]"
          onRefresh={handleRefreshSignals}
          isLoading={isSignalsLoading}
        >
          <ActiveSignalsCounter
            signals={signals}
            onSignalClick={handleSignalClick}
            showTrends={true}
            testId="active-signals-content"
          />
        </WidgetContainer>
      </div>

      {/* Row 2: Top Suspicious Wallets and Hot Markets */}
      <div className="lg:col-span-1">
        <WidgetContainer
          title="Top Suspicious Wallets"
          testId="suspicious-wallets-widget"
          className="h-full min-h-[250px]"
          onRefresh={handleRefreshWallets}
          isLoading={isWalletsLoading}
        >
          <SuspiciousWalletsWidget
            wallets={suspiciousWallets}
            maxWallets={5}
            onWalletClick={handleWalletClick}
            onWatchToggle={handleWatchToggle}
            showRiskFlags={true}
            testId="suspicious-wallets-content"
          />
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
