'use client';

import { ReactNode } from 'react';

export interface SettingsCategoryProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export default function SettingsCategory({
  id,
  title,
  description,
  children,
}: SettingsCategoryProps) {
  return (
    <section
      id={id}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
      data-testid={`settings-category-${id}`}
    >
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {children}
      </div>
    </section>
  );
}
