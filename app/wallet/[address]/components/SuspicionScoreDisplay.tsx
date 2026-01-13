'use client';

// Suspicion score display props
export interface SuspicionScoreDisplayProps {
  suspicionScore: number;
  riskLevel: string;
  riskFlags: {
    isWhale: boolean;
    isInsider: boolean;
    isFresh: boolean;
    isFlagged: boolean;
    isSanctioned: boolean;
  };
  testId?: string;
}

// Risk level configuration
const riskLevelConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  CRITICAL: {
    label: 'Critical',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    icon: '🚨',
  },
  HIGH: {
    label: 'High',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    icon: '⚠️',
  },
  MEDIUM: {
    label: 'Medium',
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    icon: '⚡',
  },
  LOW: {
    label: 'Low',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    icon: 'ℹ️',
  },
  NONE: {
    label: 'None',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    icon: '✅',
  },
};

// Get score color based on value
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-red-600 dark:text-red-400';
  if (score >= 60) return 'text-orange-600 dark:text-orange-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 20) return 'text-blue-600 dark:text-blue-400';
  return 'text-green-600 dark:text-green-400';
}

// Get score gradient color
function getScoreGradient(score: number): string {
  if (score >= 80) return 'from-red-500 to-red-700';
  if (score >= 60) return 'from-orange-500 to-orange-700';
  if (score >= 40) return 'from-yellow-500 to-yellow-700';
  if (score >= 20) return 'from-blue-500 to-blue-700';
  return 'from-green-500 to-green-700';
}

/**
 * Suspicion Score Display Component
 *
 * Displays the wallet's suspicion score with a circular gauge,
 * risk level indicator, and active risk flags.
 */
export function SuspicionScoreDisplay({
  suspicionScore,
  riskLevel,
  riskFlags,
  testId = 'suspicion-score-display',
}: SuspicionScoreDisplayProps) {
  const config = riskLevelConfig[riskLevel] ?? riskLevelConfig.NONE;
  const scoreColor = getScoreColor(suspicionScore);
  const scoreGradient = getScoreGradient(suspicionScore);

  // Calculate circumference for circular progress
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (suspicionScore / 100) * circumference;

  // Count active risk flags
  const activeRiskFlags = Object.entries(riskFlags).filter(([_, value]) => value);

  return (
    <div
      data-testid={testId}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
    >
      {/* Header */}
      <h2
        data-testid={`${testId}-title`}
        className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6"
      >
        Suspicion Score
      </h2>

      {/* Circular score gauge */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="96"
              cy="96"
              r={radius}
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-gray-200 dark:text-gray-700"
            />
            {/* Progress circle */}
            <circle
              cx="96"
              cy="96"
              r={radius}
              stroke="url(#scoreGradient)"
              strokeWidth="12"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
              data-testid={`${testId}-progress-circle`}
            />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" className={`${scoreGradient.split(' ')[0]?.replace('from-', 'text-') ?? ''}`} style={{ stopColor: 'currentColor' }} />
                <stop offset="100%" className={`${scoreGradient.split(' ')[1]?.replace('to-', 'text-') ?? ''}`} style={{ stopColor: 'currentColor' }} />
              </linearGradient>
            </defs>
          </svg>

          {/* Score number in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              data-testid={`${testId}-score`}
              className={`text-5xl font-bold ${scoreColor}`}
            >
              {suspicionScore}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">out of 100</div>
          </div>
        </div>
      </div>

      {/* Risk level badge */}
      {config && (
        <div className={`rounded-lg p-4 mb-6 ${config.bgColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{config.icon}</span>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Risk Level</div>
                <div
                  data-testid={`${testId}-risk-level`}
                  className={`text-lg font-bold ${config.color}`}
                >
                  {config.label}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk flags section */}
      <div data-testid={`${testId}-risk-flags`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Risk Flags
          </h3>
          <span
            data-testid={`${testId}-risk-flags-count`}
            className="text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            {activeRiskFlags.length} active
          </span>
        </div>

        {activeRiskFlags.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 italic">
            No active risk flags
          </div>
        ) : (
          <div className="space-y-2">
            {riskFlags.isWhale && (
              <div
                data-testid={`${testId}-flag-whale`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-blue-600 dark:text-blue-400">🐋</span>
                <span className="text-gray-700 dark:text-gray-300">Whale Activity</span>
              </div>
            )}
            {riskFlags.isInsider && (
              <div
                data-testid={`${testId}-flag-insider`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-red-600 dark:text-red-400">🎯</span>
                <span className="text-gray-700 dark:text-gray-300">Potential Insider</span>
              </div>
            )}
            {riskFlags.isFresh && (
              <div
                data-testid={`${testId}-flag-fresh`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-purple-600 dark:text-purple-400">✨</span>
                <span className="text-gray-700 dark:text-gray-300">Fresh Wallet</span>
              </div>
            )}
            {riskFlags.isFlagged && (
              <div
                data-testid={`${testId}-flag-flagged`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-orange-600 dark:text-orange-400">🚩</span>
                <span className="text-gray-700 dark:text-gray-300">Manually Flagged</span>
              </div>
            )}
            {riskFlags.isSanctioned && (
              <div
                data-testid={`${testId}-flag-sanctioned`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-red-600 dark:text-red-400">⛔</span>
                <span className="text-gray-700 dark:text-gray-300">Sanctioned</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
