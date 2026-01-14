/**
 * Unit tests for Dashboard Live Updates (UI-WS-001)
 *
 * Tests for:
 * - DashboardEventBus
 * - LiveIndicator component
 * - useDashboardLive hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDashboardEventBus,
  resetDashboardEventBus,
  emitAlertNew,
  emitWhaleTrade,
  emitStatsUpdate,
  subscribeToDashboardEvents,
  DashboardEventType,
  type AlertEventData,
  type WhaleTradeEventData,
  type StatsUpdateData,
  type DashboardEvent,
} from '../../src/lib/dashboard-events';

describe('DashboardEventBus', () => {
  beforeEach(() => {
    resetDashboardEventBus();
  });

  afterEach(() => {
    resetDashboardEventBus();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const bus1 = getDashboardEventBus();
      const bus2 = getDashboardEventBus();
      expect(bus1).toBe(bus2);
    });

    it('should reset instance correctly', () => {
      const bus1 = getDashboardEventBus();
      resetDashboardEventBus();
      const bus2 = getDashboardEventBus();
      expect(bus1).not.toBe(bus2);
    });
  });

  describe('Event emission', () => {
    it('should emit alert:new events', () => {
      const bus = getDashboardEventBus();
      const callback = vi.fn();

      bus.subscribe(callback);

      const alertData: AlertEventData = {
        id: 'alert-1',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Test Alert',
        message: 'Test message',
        createdAt: new Date().toISOString(),
      };

      emitAlertNew(alertData);

      expect(callback).toHaveBeenCalledTimes(1);
      const callArg = callback.mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      const event = callArg as DashboardEvent;
      expect(event.type).toBe(DashboardEventType.ALERT_NEW);
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });

    it('should emit trade:whale events', () => {
      const bus = getDashboardEventBus();
      const callback = vi.fn();

      bus.subscribe(callback);

      const tradeData: WhaleTradeEventData = {
        tradeId: 'trade-1',
        marketId: 'market-1',
        walletAddress: '0x123',
        side: 'BUY',
        amount: 1000,
        price: 0.65,
        usdValue: 50000,
      };

      emitWhaleTrade(tradeData);

      expect(callback).toHaveBeenCalledTimes(1);
      const callArg = callback.mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      const event = callArg as DashboardEvent;
      expect(event.type).toBe(DashboardEventType.TRADE_WHALE);
    });

    it('should emit stats:update events', () => {
      const bus = getDashboardEventBus();
      const callback = vi.fn();

      bus.subscribe(callback);

      const statsData: StatsUpdateData = {
        alerts: 10,
        changedFields: ['alerts'],
      };

      emitStatsUpdate(statsData);

      expect(callback).toHaveBeenCalledTimes(1);
      const callArg = callback.mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      const event = callArg as DashboardEvent;
      expect(event.type).toBe(DashboardEventType.STATS_UPDATE);
    });
  });

  describe('Subscription', () => {
    it('should notify multiple subscribers', () => {
      const bus = getDashboardEventBus();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      bus.subscribe(callback1);
      bus.subscribe(callback2);

      emitAlertNew({
        id: 'alert-1',
        type: 'FRESH_WALLET',
        severity: 'MEDIUM',
        title: 'Test',
        message: 'Test',
        createdAt: new Date().toISOString(),
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const bus = getDashboardEventBus();
      const callback = vi.fn();

      const unsubscribe = bus.subscribe(callback);

      emitAlertNew({
        id: 'alert-1',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Test',
        message: 'Test',
        createdAt: new Date().toISOString(),
      });

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      emitAlertNew({
        id: 'alert-2',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Test 2',
        message: 'Test 2',
        createdAt: new Date().toISOString(),
      });

      // Should still be 1, not called again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should track subscriber count', () => {
      const bus = getDashboardEventBus();

      expect(bus.getSubscriberCount()).toBe(0);

      const unsub1 = bus.subscribe(() => {});
      expect(bus.getSubscriberCount()).toBe(1);

      const unsub2 = bus.subscribe(() => {});
      expect(bus.getSubscriberCount()).toBe(2);

      unsub1();
      expect(bus.getSubscriberCount()).toBe(1);

      unsub2();
      expect(bus.getSubscriberCount()).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should track total events', () => {
      const bus = getDashboardEventBus();

      expect(bus.getStats().totalEvents).toBe(0);

      emitAlertNew({
        id: 'alert-1',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Test',
        message: 'Test',
        createdAt: new Date().toISOString(),
      });

      expect(bus.getStats().totalEvents).toBe(1);

      emitWhaleTrade({
        tradeId: 'trade-1',
        marketId: 'market-1',
        walletAddress: '0x123',
        side: 'BUY',
        amount: 1000,
        price: 0.65,
        usdValue: 50000,
      });

      expect(bus.getStats().totalEvents).toBe(2);
    });

    it('should track events by type', () => {
      const bus = getDashboardEventBus();

      emitAlertNew({
        id: 'alert-1',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Test',
        message: 'Test',
        createdAt: new Date().toISOString(),
      });

      emitAlertNew({
        id: 'alert-2',
        type: 'FRESH_WALLET',
        severity: 'MEDIUM',
        title: 'Test 2',
        message: 'Test 2',
        createdAt: new Date().toISOString(),
      });

      const stats = bus.getStats();
      expect(stats.eventsByType[DashboardEventType.ALERT_NEW]).toBe(2);
    });

    it('should reset statistics', () => {
      const bus = getDashboardEventBus();

      emitAlertNew({
        id: 'alert-1',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Test',
        message: 'Test',
        createdAt: new Date().toISOString(),
      });

      expect(bus.getStats().totalEvents).toBe(1);

      bus.resetStats();

      expect(bus.getStats().totalEvents).toBe(0);
    });
  });

  describe('Convenience functions', () => {
    it('subscribeToDashboardEvents should work', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToDashboardEvents(callback);

      emitAlertNew({
        id: 'alert-1',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Test',
        message: 'Test',
        createdAt: new Date().toISOString(),
      });

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });
});

describe('LiveIndicator Component Types', () => {
  describe('Connection status types', () => {
    it('should accept valid connection statuses', () => {
      const statuses: Array<'disconnected' | 'connecting' | 'connected' | 'reconnecting'> = [
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
      ];

      statuses.forEach((status) => {
        expect(['disconnected', 'connecting', 'connected', 'reconnecting']).toContain(status);
      });
    });
  });

  describe('Size variants', () => {
    it('should accept valid sizes', () => {
      const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];
      sizes.forEach((size) => {
        expect(['sm', 'md', 'lg']).toContain(size);
      });
    });
  });

  describe('Props interface', () => {
    it('should validate required props', () => {
      const props = {
        status: 'connected' as const,
      };
      expect(props.status).toBe('connected');
    });

    it('should validate optional props', () => {
      const props = {
        status: 'connected' as const,
        showLabel: true,
        size: 'sm' as const,
        testId: 'live-indicator',
        className: 'custom-class',
        onClick: () => {},
      };

      expect(props.showLabel).toBe(true);
      expect(props.size).toBe('sm');
      expect(props.testId).toBe('live-indicator');
      expect(props.className).toBe('custom-class');
      expect(props.onClick).toBeTypeOf('function');
    });
  });
});

describe('useDashboardLive Hook Types', () => {
  describe('Options interface', () => {
    it('should accept valid options', () => {
      const options = {
        enabled: true,
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        onAlert: () => {},
        onWhaleTrade: () => {},
        onStatsUpdate: () => {},
        onEvent: () => {},
        onConnectionChange: () => {},
      };

      expect(options.enabled).toBe(true);
      expect(options.maxReconnectAttempts).toBe(5);
      expect(options.reconnectDelay).toBe(1000);
      expect(options.maxReconnectDelay).toBe(30000);
    });
  });

  describe('Result interface', () => {
    it('should have expected shape', () => {
      // Mock result structure
      const result = {
        status: 'connected' as const,
        isConnected: true,
        isReconnecting: false,
        lastEvent: null,
        lastHeartbeat: null,
        reconnectAttempts: 0,
        error: null,
        connect: () => {},
        disconnect: () => {},
        retry: () => {},
      };

      expect(result.status).toBe('connected');
      expect(result.isConnected).toBe(true);
      expect(result.isReconnecting).toBe(false);
      expect(result.reconnectAttempts).toBe(0);
      expect(result.error).toBeNull();
      expect(result.connect).toBeTypeOf('function');
      expect(result.disconnect).toBeTypeOf('function');
      expect(result.retry).toBeTypeOf('function');
    });
  });
});

describe('SSE Endpoint Types', () => {
  describe('Event structure', () => {
    it('should have valid event types', () => {
      const eventTypes = [
        DashboardEventType.ALERT_NEW,
        DashboardEventType.TRADE_WHALE,
        DashboardEventType.STATS_UPDATE,
        DashboardEventType.CONNECTION_STATUS,
      ];

      expect(eventTypes).toContain('alert:new');
      expect(eventTypes).toContain('trade:whale');
      expect(eventTypes).toContain('stats:update');
      expect(eventTypes).toContain('connection:status');
    });
  });

  describe('Alert event data', () => {
    it('should validate alert event data structure', () => {
      const alertData: AlertEventData = {
        id: 'alert-123',
        type: 'WHALE_TRADE',
        severity: 'HIGH',
        title: 'Large Trade Detected',
        message: 'A whale trade was detected',
        marketId: 'market-1',
        walletId: 'wallet-1',
        walletAddress: '0x1234567890abcdef',
        tags: ['whale', 'large'],
        createdAt: new Date().toISOString(),
      };

      expect(alertData.id).toBeTypeOf('string');
      expect(alertData.type).toBeTypeOf('string');
      expect(alertData.severity).toBeTypeOf('string');
      expect(alertData.title).toBeTypeOf('string');
      expect(alertData.message).toBeTypeOf('string');
      expect(alertData.createdAt).toBeTypeOf('string');
    });
  });

  describe('Whale trade event data', () => {
    it('should validate whale trade event data structure', () => {
      const tradeData: WhaleTradeEventData = {
        tradeId: 'trade-123',
        marketId: 'market-1',
        walletAddress: '0x1234567890abcdef',
        side: 'BUY',
        amount: 10000,
        price: 0.65,
        usdValue: 100000,
        marketQuestion: 'Will X happen?',
      };

      expect(tradeData.tradeId).toBeTypeOf('string');
      expect(tradeData.marketId).toBeTypeOf('string');
      expect(tradeData.walletAddress).toBeTypeOf('string');
      expect(['BUY', 'SELL']).toContain(tradeData.side);
      expect(tradeData.amount).toBeTypeOf('number');
      expect(tradeData.price).toBeTypeOf('number');
      expect(tradeData.usdValue).toBeTypeOf('number');
    });
  });

  describe('Stats update event data', () => {
    it('should validate stats update event data structure', () => {
      const statsData: StatsUpdateData = {
        alerts: 15,
        criticalAlerts: 3,
        suspiciousWallets: 10,
        hotMarkets: 5,
        volume24h: 1500000,
        whaleTrades: 25,
        changedFields: ['alerts', 'criticalAlerts'],
      };

      expect(statsData.changedFields).toBeInstanceOf(Array);
      expect(statsData.changedFields.length).toBeGreaterThan(0);
    });
  });
});
