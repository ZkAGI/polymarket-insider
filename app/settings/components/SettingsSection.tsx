'use client';

import { ReactNode } from 'react';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <div className="px-6 py-4" data-testid={`settings-section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
