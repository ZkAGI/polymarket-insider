'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  WalletProfileHeader,
  SuspicionScoreDisplay,
  ActivitySummaryWidget,
} from './components';

// Wallet data interface
export interface WalletData {
  id: string;
  address: string;
  label?: string;
  walletType: string;
  isWhale: boolean;
  isInsider: boolean;
  isFresh: boolean;
  isMonitored: boolean;
  isFlagged: boolean;
  isSanctioned: boolean;
  suspicionScore: number;
  riskLevel: string;
  totalVolume: number;
  totalPnl: number;
  tradeCount: number;
  winCount: number;
  winRate: number | null;
  avgTradeSize: number | null;
  maxTradeSize: number | null;
  firstTradeAt: Date | null;
  lastTradeAt: Date | null;
  walletCreatedAt: Date | null;
  onChainTxCount: number;
  walletAgeDays: number | null;
  primaryFundingSource: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Generate mock wallet data
function generateMockWalletData(address: string): WalletData {
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const suspicionScore = (hash % 100);
  const totalVolume = 10000 + (hash % 500000);
  const tradeCount = 5 + (hash % 200);
  const winCount = Math.floor(tradeCount * (0.4 + (hash % 30) / 100));
  const winRate = (winCount / tradeCount) * 100;

  let riskLevel: string;
  if (suspicionScore >= 80) riskLevel = 'CRITICAL';
  else if (suspicionScore >= 60) riskLevel = 'HIGH';
  else if (suspicionScore >= 40) riskLevel = 'MEDIUM';
  else if (suspicionScore >= 20) riskLevel = 'LOW';
  else riskLevel = 'NONE';

  const now = new Date();
  const daysAgo = (hash % 365) + 30;
  const walletCreatedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const firstTradeAt = new Date(walletCreatedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lastTradeAt = new Date(now.getTime() - (hash % 10) * 24 * 60 * 60 * 1000);

  return {
    id: `wallet-${hash}`,
    address,
    label: hash % 3 === 0 ? `Wallet ${address.slice(0, 6)}` : undefined,
    walletType: (['EOA', 'CONTRACT', 'EXCHANGE', 'DEFI', 'BOT'] as const)[hash % 5] ?? 'UNKNOWN',
    isWhale: totalVolume > 100000,
    isInsider: suspicionScore > 75,
    isFresh: daysAgo < 60,
    isMonitored: suspicionScore > 50,
    isFlagged: suspicionScore > 70,
    isSanctioned: false,
    suspicionScore,
    riskLevel,
    totalVolume,
    totalPnl: (hash % 20000) - 10000,
    tradeCount,
    winCount,
    winRate,
    avgTradeSize: totalVolume / tradeCount,
    maxTradeSize: (totalVolume / tradeCount) * (2 + (hash % 5)),
    firstTradeAt,
    lastTradeAt,
    walletCreatedAt,
    onChainTxCount: tradeCount + (hash % 100),
    walletAgeDays: daysAgo,
    primaryFundingSource: (['EXCHANGE', 'BRIDGE', 'DIRECT', 'MIXER', null] as const)[hash % 5] ?? null,
    notes: null,
    createdAt: walletCreatedAt,
    updatedAt: lastTradeAt,
  };
}

/**
 * Wallet Profile Page
 *
 * Detailed profile page for an individual wallet address.
 * Displays wallet metadata, suspicion score, and activity summary.
 */
export default function WalletProfilePage() {
  const params = useParams();
  const router = useRouter();
  const address = params?.address as string;

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setError('No wallet address provided');
      setLoading(false);
      return;
    }

    // Validate address format (basic check)
    if (!address.startsWith('0x') || address.length !== 42) {
      setError('Invalid wallet address format');
      setLoading(false);
      return;
    }

    // Simulate API call
    const fetchWallet = async () => {
      try {
        setLoading(true);
        // In production, this would be an API call
        // const response = await fetch(`/api/wallets/${address}`);
        // const data = await response.json();

        // For now, use mock data
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mockWallet = generateMockWalletData(address);
        setWallet(mockWallet);
        setError(null);
      } catch (err) {
        console.error('Error fetching wallet:', err);
        setError('Failed to load wallet data');
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, [address]);

  const handleMonitorToggle = () => {
    if (!wallet) return;
    setWallet({ ...wallet, isMonitored: !wallet.isMonitored });
  };

  const handleFlagToggle = () => {
    if (!wallet) return;
    setWallet({ ...wallet, isFlagged: !wallet.isFlagged });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← Back to Dashboard
            </Link>
          </div>

          <div className="space-y-6">
            {/* Loading skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !wallet) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← Back to Dashboard
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {error || 'Wallet Not Found'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error
                ? 'There was a problem loading this wallet.'
                : 'The requested wallet could not be found in our database.'}
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back navigation */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Page content */}
        <div className="space-y-6">
          {/* Wallet header with metadata */}
          <WalletProfileHeader
            wallet={wallet}
            onMonitorToggle={handleMonitorToggle}
            onFlagToggle={handleFlagToggle}
          />

          {/* Suspicion score and activity grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Suspicion score display */}
            <div className="lg:col-span-1">
              <SuspicionScoreDisplay
                suspicionScore={wallet.suspicionScore}
                riskLevel={wallet.riskLevel}
                riskFlags={{
                  isWhale: wallet.isWhale,
                  isInsider: wallet.isInsider,
                  isFresh: wallet.isFresh,
                  isFlagged: wallet.isFlagged,
                  isSanctioned: wallet.isSanctioned,
                }}
              />
            </div>

            {/* Activity summary */}
            <div className="lg:col-span-2">
              <ActivitySummaryWidget
                totalVolume={wallet.totalVolume}
                totalPnl={wallet.totalPnl}
                tradeCount={wallet.tradeCount}
                winCount={wallet.winCount}
                winRate={wallet.winRate}
                avgTradeSize={wallet.avgTradeSize}
                maxTradeSize={wallet.maxTradeSize}
                firstTradeAt={wallet.firstTradeAt}
                lastTradeAt={wallet.lastTradeAt}
                walletAgeDays={wallet.walletAgeDays}
                onChainTxCount={wallet.onChainTxCount}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
