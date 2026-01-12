'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AlertsListView from './components/AlertsListView';
import AlertDetailModal, { AlertAction } from './components/AlertDetailModal';
import { FeedAlert } from '../dashboard/components/AlertFeed';

export default function AlertsPage() {
  const router = useRouter();
  const [selectedAlert, setSelectedAlert] = useState<FeedAlert | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle alert click - opens modal
  const handleAlertClick = useCallback((alert: FeedAlert) => {
    setSelectedAlert(alert);
    setIsModalOpen(true);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    // Keep selectedAlert for exit animation, clear after delay
    setTimeout(() => setSelectedAlert(null), 200);
  }, []);

  // Handle alert actions from modal
  const handleAlertAction = useCallback((action: AlertAction, alert: FeedAlert) => {
    console.log('Alert action:', action, alert.id);

    switch (action) {
      case 'MARK_READ':
        // Update alert to read state
        setSelectedAlert((prev) => prev ? { ...prev, read: true } : null);
        break;
      case 'MARK_UNREAD':
        // Update alert to unread state
        setSelectedAlert((prev) => prev ? { ...prev, read: false } : null);
        break;
      case 'ACKNOWLEDGE':
        // Update alert to acknowledged state
        setSelectedAlert((prev) => prev ? { ...prev, acknowledged: true } : null);
        break;
      case 'DISMISS':
        // Close modal (handled in modal component)
        break;
      case 'INVESTIGATE':
        // Could trigger navigation based on context
        break;
    }
  }, []);

  // Handle mark as read (from list view)
  const handleMarkRead = useCallback((alertId: string) => {
    console.log('Alert marked as read:', alertId);
    // In a real app, this would update the backend
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    console.log('Page changed to:', page);
    // In a real app, this could fetch from API or update URL
  }, []);

  // Handle navigate to market
  const handleNavigateToMarket = useCallback(
    (marketId: string) => {
      router.push(`/markets/${marketId}`);
    },
    [router]
  );

  // Handle navigate to wallet
  const handleNavigateToWallet = useCallback(
    (walletAddress: string) => {
      router.push(`/wallets/${walletAddress}`);
    },
    [router]
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AlertsListView
          onAlertClick={handleAlertClick}
          onMarkRead={handleMarkRead}
          onPageChange={handlePageChange}
          pageSize={20}
          showBackLink={true}
          testId="alerts-page"
        />
      </div>

      {/* Alert Detail Modal */}
      <AlertDetailModal
        alert={selectedAlert}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onAction={handleAlertAction}
        onNavigateToMarket={handleNavigateToMarket}
        onNavigateToWallet={handleNavigateToWallet}
        testId="alert-detail-modal"
      />
    </main>
  );
}
