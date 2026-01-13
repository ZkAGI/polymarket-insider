'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import ThemeToggle from '../../dashboard/components/ThemeToggle';

export interface SettingsLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  hasChanges?: boolean;
  isSaving?: boolean;
  saveMessage?: { type: 'success' | 'error'; text: string } | null;
  onSave?: () => void;
  onReset?: () => void;
}

export default function SettingsLayout({
  children,
  title,
  description,
  hasChanges = false,
  isSaving = false,
  saveMessage = null,
  onSave,
  onReset,
}: SettingsLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="settings-layout">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                data-testid="back-to-dashboard-link"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {title}
                </h1>
                {description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle
                mode="dropdown"
                size="sm"
                showLabel={false}
                showSystemOption={true}
                dropdownPosition="right"
                testId="settings-theme-toggle"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Save Bar (sticky when changes detected) */}
      {hasChanges && (
        <div
          className="sticky top-0 z-10 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800"
          data-testid="save-bar"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                You have unsaved changes
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={onReset}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="reset-button"
                >
                  Reset
                </button>
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  data-testid="save-button"
                >
                  {isSaving && (
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Message */}
      {saveMessage && (
        <div
          className={`${
            saveMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          } border-b`}
          data-testid="save-message"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-sm">{saveMessage.text}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
}
