'use client';

function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      data-testid="skeleton-box"
    />
  );
}

function WidgetSkeleton({ className = 'min-h-[200px]' }: { className?: string }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
      data-testid="widget-placeholder"
    >
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <SkeletonBox className="h-4 w-32" />
      </div>
      <div className="p-4 space-y-3">
        <SkeletonBox className="h-4 w-3/4" />
        <SkeletonBox className="h-4 w-1/2" />
        <SkeletonBox className="h-4 w-5/6" />
        <SkeletonBox className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="dashboard-skeleton">
      {/* Header Skeleton */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <SkeletonBox className="h-6 w-40" />
              <SkeletonBox className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBox className="h-2 w-2 rounded-full" />
              <SkeletonBox className="h-4 w-20" />
            </div>
          </div>
        </div>
      </header>

      {/* Quick Stats Bar Skeleton */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col gap-1" data-testid={`stat-skeleton-${i}`}>
                <SkeletonBox className="h-8 w-16" />
                <SkeletonBox className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Grid Skeleton */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Row 1 */}
          <div className="lg:col-span-2">
            <WidgetSkeleton className="min-h-[300px]" />
          </div>
          <div className="lg:col-span-1">
            <WidgetSkeleton className="min-h-[300px]" />
          </div>

          {/* Row 2 */}
          <WidgetSkeleton className="min-h-[250px]" />
          <WidgetSkeleton className="min-h-[250px]" />
          <WidgetSkeleton className="min-h-[250px]" />
        </div>
      </main>

      {/* Footer Skeleton */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <SkeletonBox className="h-4 w-48" />
            <SkeletonBox className="h-4 w-36" />
          </div>
        </div>
      </footer>
    </div>
  );
}
