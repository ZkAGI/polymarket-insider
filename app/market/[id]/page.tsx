'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MarketDetailHeader,
  CurrentOddsDisplay,
  MarketInfoSection,
  MarketPriceChart,
  MarketVolumeChart,
  type MarketData,
  type MarketOutcomeData,
  type PriceDataPoint,
  type ChartEvent,
  type VolumeDataPoint,
} from './components';

// Generate mock market data
function generateMockMarketData(marketId: string): MarketData {
  const hash = marketId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const questions = [
    'Will Bitcoin hit $100k by the end of 2024?',
    'Will Trump win the 2024 US Presidential Election?',
    'Will the Fed cut interest rates in March 2024?',
    'Will AI achieve AGI by the end of 2025?',
    'Will Ethereum flip Bitcoin by 2025?',
    'Will there be a recession in 2024?',
    'Will SpaceX successfully land on Mars by 2026?',
    'Will GPT-5 be released in 2024?',
    'Will US inflation drop below 2% by end of 2024?',
    'Will Taylor Swift win a Grammy in 2024?',
  ];

  const descriptions = [
    'This market will resolve to YES if the event occurs by the specified date, and NO otherwise.',
    'Resolution will be based on official announcements and verified sources.',
    'Market resolves based on publicly available information from reliable sources.',
    'This prediction market tracks the likelihood of this event occurring.',
    'Outcome will be determined using established criteria and verified data.',
  ];

  const categories = [
    'POLITICS',
    'CRYPTO',
    'FINANCE',
    'TECHNOLOGY',
    'ENTERTAINMENT',
    'SCIENCE',
    'GEOPOLITICS',
    'SPORTS',
  ];

  const questionIndex = hash % questions.length;
  const question = questions[questionIndex] ?? 'Unknown Market Question';
  const slug = question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const category = categories[hash % categories.length] ?? 'OTHER';
  const descriptionIndex = hash % descriptions.length;
  const description = descriptions[descriptionIndex] ?? 'Market description';

  const volume = 10000 + (hash % 5000000);
  const liquidity = 5000 + (hash % 1000000);
  const active = hash % 10 !== 0; // 90% active
  const closed = !active && hash % 3 === 0; // Some closed markets

  const now = new Date();
  const createdAt = new Date(now.getTime() - (30 + (hash % 180)) * 24 * 60 * 60 * 1000);
  const endDate = active ? new Date(now.getTime() + (7 + (hash % 90)) * 24 * 60 * 60 * 1000) : null;

  // Generate outcomes
  const outcomeCount = hash % 3 === 0 ? 3 : 2; // Most markets are binary (Yes/No)
  const outcomes: MarketOutcomeData[] = [];

  if (outcomeCount === 2) {
    const yesPrice = 0.2 + ((hash % 60) / 100);
    outcomes.push({
      id: `${marketId}-yes`,
      name: 'YES',
      price: yesPrice,
      probability: yesPrice * 100,
      change24h: -5 + ((hash % 10) - 5),
      clobTokenId: `clob-${marketId}-yes`,
    });
    outcomes.push({
      id: `${marketId}-no`,
      name: 'NO',
      price: 1 - yesPrice,
      probability: (1 - yesPrice) * 100,
      change24h: 5 - ((hash % 10) - 5),
      clobTokenId: `clob-${marketId}-no`,
    });
  } else {
    // Multiple choice market
    const prices = [0.4 + ((hash % 20) / 100), 0.3 + ((hash % 15) / 100), 0.3 - ((hash % 10) / 100)];
    const names = ['Option A', 'Option B', 'Option C'];
    names.forEach((name, i) => {
      const price = prices[i] ?? 0.33;
      outcomes.push({
        id: `${marketId}-option-${i}`,
        name,
        price,
        probability: price * 100,
        change24h: -5 + ((hash + i * 13) % 10),
        clobTokenId: `clob-${marketId}-option-${i}`,
      });
    });
  }

  return {
    id: marketId,
    question,
    slug,
    description,
    category,
    active,
    closed,
    archived: false,
    outcomes,
    volume,
    liquidity,
    createdAt,
    endDate,
    updatedAt: now,
    image: undefined,
    icon: undefined,
    resolutionSource: 'Official sources and verified data',
    polymarketUrl: `https://polymarket.com/${slug}`,
  };
}

/**
 * Generate mock price history data for a market outcome
 */
function generateMockPriceHistory(
  marketId: string,
  outcomeId: string,
  currentPrice: number,
  daysOfHistory: number = 180
): PriceDataPoint[] {
  const hash = (marketId + outcomeId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const points: PriceDataPoint[] = [];
  const now = new Date();
  const pointsPerDay = 24; // One point per hour
  const totalPoints = daysOfHistory * pointsPerDay;

  // Determine trend (upward or downward)
  const trendDirection = hash % 2 === 0 ? 1 : -1;
  const trendStrength = 0.2 + ((hash % 30) / 100); // 0.2 to 0.5

  // Starting price (work backwards from current price)
  const startPrice = Math.max(5, Math.min(95, currentPrice - trendDirection * trendStrength * 100 * (hash % 3)));

  for (let i = 0; i < totalPoints; i++) {
    const progress = i / totalPoints;
    const timestamp = new Date(now.getTime() - (totalPoints - i) * 60 * 60 * 1000);

    // Calculate base price with trend
    let price = startPrice + trendDirection * trendStrength * 100 * progress;

    // Add sine wave for natural fluctuations
    const sineWave = Math.sin(progress * Math.PI * 4 + hash) * 8;
    price += sineWave;

    // Add random noise
    const noise = (Math.sin((i * 7 + hash) * 0.1) * 3) + (Math.sin((i * 13 + hash) * 0.05) * 2);
    price += noise;

    // Add occasional jumps (simulating news events)
    if (i % 100 === hash % 100) {
      price += (hash % 2 === 0 ? 1 : -1) * (5 + (hash % 10));
    }

    // Ensure price stays in valid range
    price = Math.max(5, Math.min(95, price));

    // Calculate volume (higher volume during price changes)
    const priceChange = i > 0 ? Math.abs(price - (points[i - 1]?.probability ?? price)) : 0;
    const baseVolume = 10000 + (hash % 50000);
    const volume = baseVolume * (1 + priceChange * 2);

    points.push({
      timestamp,
      price: price / 100,
      probability: price,
      volume,
    });
  }

  return points;
}

/**
 * Generate mock chart events for a market
 */
function generateMockChartEvents(marketId: string, daysOfHistory: number = 180): ChartEvent[] {
  const hash = marketId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const events: ChartEvent[] = [];
  const now = new Date();
  const eventCount = 3 + (hash % 5); // 3-7 events

  const eventLabels = [
    'Major news announcement',
    'Large whale trade detected',
    'Market sentiment shift',
    'Related market resolved',
    'Breaking news',
    'Insider activity alert',
    'Volume spike detected',
    'Price manipulation suspected',
  ];

  const eventTypes: ChartEvent['type'][] = ['news', 'trade', 'alert', 'other'];

  for (let i = 0; i < eventCount; i++) {
    const dayOffset = Math.floor((daysOfHistory * (i + 1)) / (eventCount + 1));
    const timestamp = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const labelIndex = (hash + i * 17) % eventLabels.length;
    const typeIndex = (hash + i * 13) % eventTypes.length;

    events.push({
      timestamp,
      label: eventLabels[labelIndex] ?? 'Market event',
      type: eventTypes[typeIndex] ?? 'other',
    });
  }

  return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Generate mock volume history data for a market
 */
function generateMockVolumeHistory(marketId: string, daysOfHistory: number = 180): VolumeDataPoint[] {
  const hash = marketId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const points: VolumeDataPoint[] = [];
  const now = new Date();
  const pointsPerDay = 24; // One point per hour
  const totalPoints = daysOfHistory * pointsPerDay;

  // Base volume level
  const baseVolume = 50000 + (hash % 200000);

  for (let i = 0; i < totalPoints; i++) {
    const progress = i / totalPoints;
    const timestamp = new Date(now.getTime() - (totalPoints - i) * 60 * 60 * 1000);

    // Calculate volume with trend
    let volume = baseVolume * (1 + progress * 0.3); // 30% growth trend

    // Add daily cycle (higher during business hours)
    const hour = timestamp.getHours();
    const dailyCycle = hour >= 9 && hour <= 17 ? 1.3 : 0.7;
    volume *= dailyCycle;

    // Add sine wave for natural fluctuations
    const sineWave = Math.sin(progress * Math.PI * 8 + hash) * 0.2;
    volume *= (1 + sineWave);

    // Add random noise
    const noise = (Math.sin((i * 11 + hash) * 0.1) * 0.15) + (Math.sin((i * 17 + hash) * 0.05) * 0.1);
    volume *= (1 + noise);

    // Add occasional spikes (simulating volume surges)
    if (i % 80 === hash % 80) {
      volume *= 2 + (hash % 3); // 2x to 4x spike
    }

    // Ensure volume is positive
    volume = Math.max(1000, volume);

    // Calculate trade count (proportional to volume)
    const tradeCount = Math.floor(volume / (500 + (hash % 1000)));

    points.push({
      timestamp,
      volume,
      tradeCount,
    });
  }

  return points;
}

/**
 * Market Detail Page
 *
 * Detailed page for an individual prediction market.
 * Displays market information, current odds, price history chart, and links to Polymarket.
 */
export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params?.id as string;

  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) {
      setError('No market ID provided');
      setLoading(false);
      return;
    }

    // Simulate API call
    const fetchMarket = async () => {
      try {
        setLoading(true);
        // In production, this would be an API call
        // const response = await fetch(`/api/markets/${marketId}`);
        // const data = await response.json();

        // For now, use mock data
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mockMarket = generateMockMarketData(marketId);
        setMarket(mockMarket);

        setError(null);
      } catch (err) {
        console.error('Error fetching market:', err);
        setError('Failed to load market data');
      } finally {
        setLoading(false);
      }
    };

    fetchMarket();
  }, [marketId]);

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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
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

  if (error || !market) {
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
              {error || 'Market Not Found'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error
                ? 'There was a problem loading this market.'
                : 'The requested market could not be found in our database.'}
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

  // Generate price history for the primary outcome
  const primaryOutcome = market.outcomes[0];
  const priceHistory = primaryOutcome
    ? generateMockPriceHistory(market.id, primaryOutcome.id, primaryOutcome.probability)
    : [];
  const chartEvents = generateMockChartEvents(market.id);
  const volumeHistory = generateMockVolumeHistory(market.id);

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
          {/* Market header with question and metadata */}
          <MarketDetailHeader market={market} />

          {/* Two column layout for odds and info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current odds display */}
            <CurrentOddsDisplay outcomes={market.outcomes} />

            {/* Market info section */}
            <MarketInfoSection market={market} />
          </div>

  {/* Price history chart */}
          {primaryOutcome && (
            <MarketPriceChart
              priceHistory={priceHistory}
              events={chartEvents}
              outcomeName={primaryOutcome.name}
              height={400}
              enableZoom={true}
              enablePan={true}
              showGrid={true}
            />
          )}

          {/* Volume chart */}
          <MarketVolumeChart
            volumeHistory={volumeHistory}
            height={300}
            showGrid={true}
            highlightAnomalies={true}
            anomalyThreshold={2.5}
          />
        </div>
      </div>
    </div>
  );
}
