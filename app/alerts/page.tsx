'use client';

import { useCallback } from 'react';
import AlertsListView from './components/AlertsListView';
import { FeedAlert } from '../dashboard/components/AlertFeed';

export default function AlertsPage() {
  // Handle alert click - could open modal in future (UI-ALERT-002)
  const handleAlertClick = useCallback((alert: FeedAlert) => {
    console.log('Alert clicked:', alert);
    // In a real app, this would open a detail modal
  }, []);

  // Handle mark as read
  const handleMarkRead = useCallback((alertId: string) => {
    console.log('Alert marked as read:', alertId);
    // In a real app, this would update the backend
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    console.log('Page changed to:', page);
    // In a real app, this could fetch from API or update URL
  }, []);

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
    </main>
  );
}
