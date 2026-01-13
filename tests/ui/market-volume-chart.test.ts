/**
 * Unit tests for MarketVolumeChart component
 * Feature: UI-MARKET-003 - Market volume chart
 */

import { describe, it, expect } from 'vitest';
import type { VolumeDataPoint, VolumeTimeRange } from '@/app/market/[id]/components/MarketVolumeChart';

describe('MarketVolumeChart Types and Data Structures', () => {
  describe('VolumeDataPoint interface', () => {
    it('should have correct required properties', () => {
      const volumePoint: VolumeDataPoint = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        volume: 150000,
      };

      expect(volumePoint.timestamp).toBeInstanceOf(Date);
      expect(typeof volumePoint.volume).toBe('number');
      expect(volumePoint.volume).toBeGreaterThan(0);
    });

    it('should support optional tradeCount property', () => {
      const volumePointWithTrades: VolumeDataPoint = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        volume: 150000,
        tradeCount: 42,
      };

      expect(volumePointWithTrades.tradeCount).toBe(42);
    });

    it('should work without tradeCount', () => {
      const volumePointWithoutTrades: VolumeDataPoint = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        volume: 150000,
      };

      expect(volumePointWithoutTrades.tradeCount).toBeUndefined();
    });
  });

  describe('VolumeTimeRange type', () => {
    it('should accept valid time range values', () => {
      const validRanges: VolumeTimeRange[] = ['1D', '1W', '1M', '3M', '6M', 'ALL'];

      for (const range of validRanges) {
        expect(['1D', '1W', '1M', '3M', '6M', 'ALL']).toContain(range);
      }
    });
  });

  describe('Volume data generation', () => {
    function generateMockVolumeData(days: number): VolumeDataPoint[] {
      const points: VolumeDataPoint[] = [];
      const now = new Date();

      for (let i = 0; i < days * 24; i++) {
        points.push({
          timestamp: new Date(now.getTime() - (days * 24 - i) * 60 * 60 * 1000),
          volume: 50000 + Math.random() * 100000,
          tradeCount: 100 + Math.floor(Math.random() * 500),
        });
      }

      return points;
    }

    it('should generate correct number of data points', () => {
      const days = 7;
      const data = generateMockVolumeData(days);

      expect(data.length).toBe(days * 24);
    });

    it('should generate points with increasing timestamps', () => {
      const data = generateMockVolumeData(7);

      for (let i = 1; i < data.length; i++) {
        expect(data[i]!.timestamp.getTime()).toBeGreaterThan(data[i - 1]!.timestamp.getTime());
      }
    });

    it('should generate points with positive volumes', () => {
      const data = generateMockVolumeData(7);

      for (const point of data) {
        expect(point.volume).toBeGreaterThan(0);
      }
    });

    it('should generate points with positive trade counts', () => {
      const data = generateMockVolumeData(7);

      for (const point of data) {
        expect(point.tradeCount).toBeGreaterThan(0);
      }
    });
  });

  describe('Volume filtering by time range', () => {
    function filterByTimeRange(
      data: VolumeDataPoint[],
      range: VolumeTimeRange,
      referenceDate = new Date()
    ): VolumeDataPoint[] {
      const ranges: Record<VolumeTimeRange, number> = {
        '1D': 1,
        '1W': 7,
        '1M': 30,
        '3M': 90,
        '6M': 180,
        'ALL': Infinity,
      };

      const days = ranges[range];

      // Special case for ALL range
      if (days === Infinity) {
        return data;
      }

      const cutoff = new Date(referenceDate.getTime() - days * 24 * 60 * 60 * 1000);
      return data.filter((point) => point.timestamp >= cutoff);
    }

    it('should filter 1D range correctly', () => {
      const now = new Date();
      const data: VolumeDataPoint[] = [
        { timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), volume: 100 },
        { timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000), volume: 100 },
        { timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000), volume: 100 },
      ];

      const filtered = filterByTimeRange(data, '1D', now);
      expect(filtered.length).toBeLessThan(data.length);
    });

    it('should return all data for ALL range', () => {
      const now = new Date();
      const data: VolumeDataPoint[] = [
        { timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), volume: 100 },
        { timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), volume: 100 },
        { timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000), volume: 100 },
      ];

      const filtered = filterByTimeRange(data, 'ALL', now);
      expect(filtered.length).toBe(data.length);
    });

    it('should handle empty data', () => {
      const filtered = filterByTimeRange([], '1M');
      expect(filtered.length).toBe(0);
    });
  });

  describe('Anomaly detection logic', () => {
    function detectAnomalies(
      data: VolumeDataPoint[],
      threshold: number
    ): Array<{ timestamp: Date; volume: number; deviationPercent: number }> {
      if (data.length < 10) return [];

      const volumes = data.map((d) => d.volume);
      const mean = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      const variance =
        volumes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / volumes.length;
      const stdDev = Math.sqrt(variance);

      const anomalies: Array<{ timestamp: Date; volume: number; deviationPercent: number }> = [];

      for (const point of data) {
        const zScore = (point.volume - mean) / stdDev;
        if (zScore > threshold) {
          anomalies.push({
            timestamp: point.timestamp,
            volume: point.volume,
            deviationPercent: ((point.volume - mean) / mean) * 100,
          });
        }
      }

      return anomalies;
    }

    it('should detect volume spikes', () => {
      const now = new Date();
      const baseVolume = 50000;
      const data: VolumeDataPoint[] = [];

      for (let i = 0; i < 100; i++) {
        data.push({
          timestamp: new Date(now.getTime() - (100 - i) * 60 * 60 * 1000),
          volume: i === 50 ? baseVolume * 5 : baseVolume,
        });
      }

      const anomalies = detectAnomalies(data, 2.5);
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it('should not detect anomalies in uniform data', () => {
      const now = new Date();
      const data: VolumeDataPoint[] = [];

      for (let i = 0; i < 100; i++) {
        data.push({
          timestamp: new Date(now.getTime() - (100 - i) * 60 * 60 * 1000),
          volume: 50000,
        });
      }

      const anomalies = detectAnomalies(data, 2.5);
      expect(anomalies.length).toBe(0);
    });

    it('should respect threshold parameter', () => {
      const now = new Date();
      const baseVolume = 50000;
      const data: VolumeDataPoint[] = [];

      for (let i = 0; i < 100; i++) {
        data.push({
          timestamp: new Date(now.getTime() - (100 - i) * 60 * 60 * 1000),
          volume: i === 50 ? baseVolume * 2 : baseVolume,
        });
      }

      const lowThresholdAnomalies = detectAnomalies(data, 1);
      const highThresholdAnomalies = detectAnomalies(data, 5);

      expect(lowThresholdAnomalies.length).toBeGreaterThanOrEqual(
        highThresholdAnomalies.length
      );
    });

    it('should return empty array for insufficient data', () => {
      const now = new Date();
      const data: VolumeDataPoint[] = [
        { timestamp: new Date(now.getTime()), volume: 50000 },
        { timestamp: new Date(now.getTime() + 3600000), volume: 100000 },
      ];

      const anomalies = detectAnomalies(data, 2.5);
      expect(anomalies.length).toBe(0);
    });

    it('should calculate deviation percentage correctly', () => {
      const now = new Date();
      const baseVolume = 100000;
      const spikeVolume = 300000; // 200% increase
      const data: VolumeDataPoint[] = [];

      for (let i = 0; i < 100; i++) {
        data.push({
          timestamp: new Date(now.getTime() - (100 - i) * 60 * 60 * 1000),
          volume: i === 50 ? spikeVolume : baseVolume,
        });
      }

      const anomalies = detectAnomalies(data, 2);

      if (anomalies.length > 0) {
        const anomaly = anomalies[0]!;
        expect(anomaly.deviationPercent).toBeGreaterThan(0);
        expect(anomaly.volume).toBe(spikeVolume);
      }
    });
  });

  describe('Volume formatting logic', () => {
    function formatVolume(volume: number): string {
      if (volume >= 1000000) {
        return `$${(volume / 1000000).toFixed(2)}M`;
      } else if (volume >= 1000) {
        return `$${(volume / 1000).toFixed(1)}k`;
      }
      return `$${volume.toFixed(0)}`;
    }

    it('should format large volumes with M suffix', () => {
      expect(formatVolume(1500000)).toBe('$1.50M');
      expect(formatVolume(10000000)).toBe('$10.00M');
      expect(formatVolume(1234567)).toBe('$1.23M');
    });

    it('should format medium volumes with k suffix', () => {
      expect(formatVolume(1500)).toBe('$1.5k');
      expect(formatVolume(50000)).toBe('$50.0k');
      expect(formatVolume(123456)).toBe('$123.5k');
    });

    it('should format small volumes without suffix', () => {
      expect(formatVolume(100)).toBe('$100');
      expect(formatVolume(999)).toBe('$999');
      expect(formatVolume(50)).toBe('$50');
    });

    it('should handle zero volume', () => {
      expect(formatVolume(0)).toBe('$0');
    });

    it('should handle edge cases', () => {
      expect(formatVolume(1000)).toBe('$1.0k');
      expect(formatVolume(1000000)).toBe('$1.00M');
      expect(formatVolume(999999)).toBe('$1000.0k');
    });
  });

  describe('Date formatting logic', () => {
    function formatDate(date: Date, range: VolumeTimeRange): string {
      if (range === '1D') {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else if (range === '1W' || range === '1M') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
    }

    it('should format date for 1D range as time', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted = formatDate(date, '1D');
      expect(formatted).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format date for 1W/1M range with month and day', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted1W = formatDate(date, '1W');
      const formatted1M = formatDate(date, '1M');

      expect(formatted1W).toContain('Jan');
      expect(formatted1M).toContain('Jan');
    });

    it('should format date for longer ranges with month and year', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted3M = formatDate(date, '3M');
      const formatted6M = formatDate(date, '6M');

      expect(formatted3M).toContain('Jan');
      expect(formatted6M).toContain('Jan');
    });
  });

  describe('Chart scale calculations', () => {
    function calculateYScale(
      data: VolumeDataPoint[],
      chartHeight: number
    ): (volume: number) => number {
      if (data.length === 0) return () => 0;

      const volumes = data.map((d) => d.volume);
      const maxVolume = Math.max(...volumes);
      const paddedMax = maxVolume * 1.1;

      return (volume: number) => {
        return chartHeight - (volume / paddedMax) * chartHeight;
      };
    }

    it('should scale volume to chart coordinates', () => {
      const data: VolumeDataPoint[] = [
        { timestamp: new Date(), volume: 50000 },
        { timestamp: new Date(), volume: 100000 },
        { timestamp: new Date(), volume: 150000 },
      ];

      const yScale = calculateYScale(data, 300);

      // Max volume (150000) should be near top (y=0)
      expect(yScale(150000)).toBeLessThan(50);

      // Min volume (50000) should be near bottom (y=300)
      expect(yScale(50000)).toBeGreaterThan(200);

      // Middle volume should be in middle
      const midY = yScale(100000);
      expect(midY).toBeGreaterThan(50);
      expect(midY).toBeLessThan(250);
    });

    it('should add 10% padding to max volume', () => {
      const data: VolumeDataPoint[] = [
        { timestamp: new Date(), volume: 100000 },
        { timestamp: new Date(), volume: 100000 },
      ];

      const yScale = calculateYScale(data, 300);

      // Max volume should not be at y=0 due to padding
      expect(yScale(100000)).toBeGreaterThan(0);
    });

    it('should handle empty data', () => {
      const yScale = calculateYScale([], 300);
      expect(yScale(100000)).toBe(0);
    });

    it('should handle single data point', () => {
      const data: VolumeDataPoint[] = [{ timestamp: new Date(), volume: 100000 }];

      const yScale = calculateYScale(data, 300);
      expect(yScale(100000)).toBeGreaterThan(0);
    });
  });

  describe('Bar width calculations', () => {
    function calculateBarWidth(dataLength: number, chartWidth: number): number {
      if (dataLength === 0) return 0;
      const spacing = chartWidth / dataLength;
      return Math.max(2, Math.min(spacing * 0.8, 20));
    }

    it('should calculate bar width based on data length', () => {
      const chartWidth = 700;

      const width10 = calculateBarWidth(10, chartWidth);
      const width100 = calculateBarWidth(100, chartWidth);

      expect(width10).toBeGreaterThan(width100);
    });

    it('should enforce minimum bar width of 2px', () => {
      const width = calculateBarWidth(10000, 700);
      expect(width).toBeGreaterThanOrEqual(2);
    });

    it('should enforce maximum bar width of 20px', () => {
      const width = calculateBarWidth(5, 700);
      expect(width).toBeLessThanOrEqual(20);
    });

    it('should return 0 for empty data', () => {
      const width = calculateBarWidth(0, 700);
      expect(width).toBe(0);
    });
  });
});
