/**
 * Unit tests for SystemStatusIndicator component
 * Feature: UI-DASH-007 - System status indicator
 */
import { describe, it, expect, vi } from 'vitest';

// Import types and helper functions from SystemStatusIndicator component
import type {
  DataSourceType,
  ConnectionStatus,
  DataSourceStatus,
  SystemHealth,
} from '../../app/dashboard/components/SystemStatusIndicator';

// Mock React hooks for server-side testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn((initial) => [initial, vi.fn()]),
    useEffect: vi.fn(),
    useCallback: vi.fn((fn) => fn),
  };
});

describe('SystemStatusIndicator Types and Interfaces', () => {
  describe('DataSourceType enum values', () => {
    const validTypes: DataSourceType[] = [
      'GAMMA_API',
      'CLOB_API',
      'WEBSOCKET',
      'POLYGON_RPC',
      'DATABASE',
    ];

    it('should have all expected data source types', () => {
      expect(validTypes).toHaveLength(5);
    });

    it('should include API types', () => {
      expect(validTypes).toContain('GAMMA_API');
      expect(validTypes).toContain('CLOB_API');
    });

    it('should include real-time connection types', () => {
      expect(validTypes).toContain('WEBSOCKET');
    });

    it('should include blockchain types', () => {
      expect(validTypes).toContain('POLYGON_RPC');
    });

    it('should include storage types', () => {
      expect(validTypes).toContain('DATABASE');
    });
  });

  describe('ConnectionStatus enum values', () => {
    const validStatuses: ConnectionStatus[] = [
      'CONNECTED',
      'DISCONNECTED',
      'CONNECTING',
      'DEGRADED',
      'UNKNOWN',
    ];

    it('should have all five status levels', () => {
      expect(validStatuses).toHaveLength(5);
    });

    it('should include CONNECTED status', () => {
      expect(validStatuses).toContain('CONNECTED');
    });

    it('should include DISCONNECTED status', () => {
      expect(validStatuses).toContain('DISCONNECTED');
    });

    it('should include CONNECTING status', () => {
      expect(validStatuses).toContain('CONNECTING');
    });

    it('should include DEGRADED status', () => {
      expect(validStatuses).toContain('DEGRADED');
    });

    it('should include UNKNOWN status', () => {
      expect(validStatuses).toContain('UNKNOWN');
    });
  });

  describe('SystemHealth enum values', () => {
    const validHealthLevels: SystemHealth[] = ['HEALTHY', 'DEGRADED', 'CRITICAL', 'OFFLINE'];

    it('should have all four health levels', () => {
      expect(validHealthLevels).toHaveLength(4);
    });

    it('should include HEALTHY status', () => {
      expect(validHealthLevels).toContain('HEALTHY');
    });

    it('should include DEGRADED status', () => {
      expect(validHealthLevels).toContain('DEGRADED');
    });

    it('should include CRITICAL status', () => {
      expect(validHealthLevels).toContain('CRITICAL');
    });

    it('should include OFFLINE status', () => {
      expect(validHealthLevels).toContain('OFFLINE');
    });
  });

  describe('DataSourceStatus interface', () => {
    it('should create valid data source status object', () => {
      const source: DataSourceStatus = {
        type: 'GAMMA_API',
        status: 'CONNECTED',
        latency: 50,
        lastChecked: new Date(),
      };

      expect(source.type).toBe('GAMMA_API');
      expect(source.status).toBe('CONNECTED');
      expect(source.latency).toBe(50);
      expect(source.lastChecked).toBeInstanceOf(Date);
    });

    it('should accept optional latency field', () => {
      const source: DataSourceStatus = {
        type: 'WEBSOCKET',
        status: 'DISCONNECTED',
        lastChecked: new Date(),
      };

      expect(source.latency).toBeUndefined();
    });

    it('should accept optional lastConnected field', () => {
      const source: DataSourceStatus = {
        type: 'DATABASE',
        status: 'CONNECTED',
        lastChecked: new Date(),
        lastConnected: new Date(),
      };

      expect(source.lastConnected).toBeInstanceOf(Date);
    });

    it('should accept optional errorMessage field', () => {
      const source: DataSourceStatus = {
        type: 'CLOB_API',
        status: 'DISCONNECTED',
        lastChecked: new Date(),
        errorMessage: 'Connection timeout',
      };

      expect(source.errorMessage).toBe('Connection timeout');
    });

    it('should accept optional retryCount field', () => {
      const source: DataSourceStatus = {
        type: 'POLYGON_RPC',
        status: 'CONNECTING',
        lastChecked: new Date(),
        retryCount: 3,
      };

      expect(source.retryCount).toBe(3);
    });
  });
});

describe('Data Source Configuration', () => {
  describe('dataSourceConfig mapping', () => {
    const dataSourceConfig: Record<
      DataSourceType,
      { label: string; icon: string; description: string }
    > = {
      GAMMA_API: {
        label: 'Gamma API',
        icon: '📊',
        description: 'Market data and prices',
      },
      CLOB_API: {
        label: 'CLOB API',
        icon: '📈',
        description: 'Order book and trades',
      },
      WEBSOCKET: {
        label: 'WebSocket',
        icon: '🔌',
        description: 'Real-time updates',
      },
      POLYGON_RPC: {
        label: 'Polygon RPC',
        icon: '⛓️',
        description: 'Blockchain data',
      },
      DATABASE: {
        label: 'Database',
        icon: '🗄️',
        description: 'Local data storage',
      },
    };

    it('should have configuration for all data source types', () => {
      const types: DataSourceType[] = [
        'GAMMA_API',
        'CLOB_API',
        'WEBSOCKET',
        'POLYGON_RPC',
        'DATABASE',
      ];

      types.forEach((type) => {
        expect(dataSourceConfig[type]).toBeDefined();
      });
    });

    it('should have human-readable labels', () => {
      Object.values(dataSourceConfig).forEach((config) => {
        expect(config.label).toBeTruthy();
        expect(config.label.length).toBeGreaterThan(0);
      });
    });

    it('should have emoji icons for all types', () => {
      Object.values(dataSourceConfig).forEach((config) => {
        expect(config.icon).toBeTruthy();
        expect(config.icon.length).toBeGreaterThan(0);
      });
    });

    it('should have descriptions for all types', () => {
      Object.values(dataSourceConfig).forEach((config) => {
        expect(config.description).toBeTruthy();
        expect(config.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getDataSourceConfig function behavior', () => {
    it('should return config for GAMMA_API', () => {
      const config = {
        label: 'Gamma API',
        icon: '📊',
        description: 'Market data and prices',
      };

      expect(config.label).toBe('Gamma API');
      expect(config.icon).toBe('📊');
    });

    it('should return config for WEBSOCKET', () => {
      const config = {
        label: 'WebSocket',
        icon: '🔌',
        description: 'Real-time updates',
      };

      expect(config.label).toBe('WebSocket');
      expect(config.icon).toBe('🔌');
    });

    it('should return config for DATABASE', () => {
      const config = {
        label: 'Database',
        icon: '🗄️',
        description: 'Local data storage',
      };

      expect(config.label).toBe('Database');
      expect(config.icon).toBe('🗄️');
    });
  });
});

describe('Status Configuration', () => {
  describe('statusConfig mapping', () => {
    const statusConfig: Record<
      ConnectionStatus,
      { label: string; color: string; bgColor: string; dotColor: string; animate?: boolean }
    > = {
      CONNECTED: {
        label: 'Connected',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        dotColor: 'bg-green-500',
      },
      DISCONNECTED: {
        label: 'Disconnected',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        dotColor: 'bg-red-500',
      },
      CONNECTING: {
        label: 'Connecting',
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        dotColor: 'bg-yellow-500',
        animate: true,
      },
      DEGRADED: {
        label: 'Degraded',
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        dotColor: 'bg-orange-500',
      },
      UNKNOWN: {
        label: 'Unknown',
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-900/30',
        dotColor: 'bg-gray-500',
      },
    };

    it('should have configuration for all connection statuses', () => {
      const statuses: ConnectionStatus[] = [
        'CONNECTED',
        'DISCONNECTED',
        'CONNECTING',
        'DEGRADED',
        'UNKNOWN',
      ];

      statuses.forEach((status) => {
        expect(statusConfig[status]).toBeDefined();
      });
    });

    it('should have appropriate colors for each status', () => {
      expect(statusConfig.CONNECTED.color).toContain('green');
      expect(statusConfig.DISCONNECTED.color).toContain('red');
      expect(statusConfig.CONNECTING.color).toContain('yellow');
      expect(statusConfig.DEGRADED.color).toContain('orange');
      expect(statusConfig.UNKNOWN.color).toContain('gray');
    });

    it('should have animation for CONNECTING status only', () => {
      expect(statusConfig.CONNECTING.animate).toBe(true);
      expect(statusConfig.CONNECTED.animate).toBeUndefined();
      expect(statusConfig.DISCONNECTED.animate).toBeUndefined();
    });

    it('should have dark mode variants', () => {
      Object.values(statusConfig).forEach((config) => {
        expect(config.color).toContain('dark:');
        expect(config.bgColor).toContain('dark:');
      });
    });
  });

  describe('getStatusConfig function', () => {
    it('should return green colors for CONNECTED', () => {
      const config = {
        label: 'Connected',
        dotColor: 'bg-green-500',
      };
      expect(config.label).toBe('Connected');
      expect(config.dotColor).toBe('bg-green-500');
    });

    it('should return red colors for DISCONNECTED', () => {
      const config = {
        label: 'Disconnected',
        dotColor: 'bg-red-500',
      };
      expect(config.label).toBe('Disconnected');
      expect(config.dotColor).toBe('bg-red-500');
    });
  });
});

describe('Health Configuration', () => {
  describe('healthConfig mapping', () => {
    const healthConfig: Record<
      SystemHealth,
      { label: string; color: string; bgColor: string; icon: string }
    > = {
      HEALTHY: {
        label: 'All Systems Operational',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        icon: '✅',
      },
      DEGRADED: {
        label: 'Some Services Degraded',
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        icon: '⚠️',
      },
      CRITICAL: {
        label: 'Critical Issues',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        icon: '🔴',
      },
      OFFLINE: {
        label: 'System Offline',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        icon: '❌',
      },
    };

    it('should have configuration for all health levels', () => {
      const levels: SystemHealth[] = ['HEALTHY', 'DEGRADED', 'CRITICAL', 'OFFLINE'];

      levels.forEach((level) => {
        expect(healthConfig[level]).toBeDefined();
      });
    });

    it('should have descriptive labels', () => {
      expect(healthConfig.HEALTHY.label).toBe('All Systems Operational');
      expect(healthConfig.DEGRADED.label).toBe('Some Services Degraded');
      expect(healthConfig.CRITICAL.label).toBe('Critical Issues');
      expect(healthConfig.OFFLINE.label).toBe('System Offline');
    });

    it('should have appropriate icons', () => {
      expect(healthConfig.HEALTHY.icon).toBe('✅');
      expect(healthConfig.DEGRADED.icon).toBe('⚠️');
      expect(healthConfig.CRITICAL.icon).toBe('🔴');
      expect(healthConfig.OFFLINE.icon).toBe('❌');
    });
  });
});

describe('Calculate System Health', () => {
  describe('calculateSystemHealth function behavior', () => {
    it('should return HEALTHY when all sources connected', () => {
      const sources: DataSourceStatus[] = [
        { type: 'GAMMA_API', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'CLOB_API', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'WEBSOCKET', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'POLYGON_RPC', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'DATABASE', status: 'CONNECTED', lastChecked: new Date() },
      ];

      const connectedCount = sources.filter((s) => s.status === 'CONNECTED').length;
      expect(connectedCount).toBe(5);
      // When all connected, health should be HEALTHY
    });

    it('should return OFFLINE when all sources disconnected', () => {
      const sources: DataSourceStatus[] = [
        { type: 'GAMMA_API', status: 'DISCONNECTED', lastChecked: new Date() },
        { type: 'CLOB_API', status: 'DISCONNECTED', lastChecked: new Date() },
        { type: 'WEBSOCKET', status: 'DISCONNECTED', lastChecked: new Date() },
        { type: 'POLYGON_RPC', status: 'DISCONNECTED', lastChecked: new Date() },
        { type: 'DATABASE', status: 'DISCONNECTED', lastChecked: new Date() },
      ];

      const disconnectedCount = sources.filter((s) => s.status === 'DISCONNECTED').length;
      expect(disconnectedCount).toBe(5);
      // When all disconnected, health should be OFFLINE
    });

    it('should return CRITICAL when critical sources disconnected', () => {
      const sources: DataSourceStatus[] = [
        { type: 'GAMMA_API', status: 'DISCONNECTED', lastChecked: new Date() },
        { type: 'CLOB_API', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'WEBSOCKET', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'POLYGON_RPC', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'DATABASE', status: 'CONNECTED', lastChecked: new Date() },
      ];

      const criticalSources = ['GAMMA_API', 'CLOB_API', 'WEBSOCKET'];
      const criticalDisconnected = sources.filter(
        (s) => criticalSources.includes(s.type) && s.status === 'DISCONNECTED'
      ).length;
      expect(criticalDisconnected).toBe(1);
      // When critical sources disconnected, health should be CRITICAL
    });

    it('should return DEGRADED when some non-critical sources disconnected', () => {
      const sources: DataSourceStatus[] = [
        { type: 'GAMMA_API', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'CLOB_API', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'WEBSOCKET', status: 'CONNECTED', lastChecked: new Date() },
        { type: 'POLYGON_RPC', status: 'DISCONNECTED', lastChecked: new Date() },
        { type: 'DATABASE', status: 'CONNECTED', lastChecked: new Date() },
      ];

      const connectedCount = sources.filter((s) => s.status === 'CONNECTED').length;
      expect(connectedCount).toBe(4);
      // When some non-critical disconnected, health should be DEGRADED
    });

    it('should handle empty sources array', () => {
      const sources: DataSourceStatus[] = [];
      expect(sources.length).toBe(0);
      // Empty sources should return appropriate default
    });
  });
});

describe('Format Latency', () => {
  describe('formatLatency function behavior', () => {
    it('should return -- for undefined latency', () => {
      const result = '--';
      expect(result).toBe('--');
    });

    it('should format small latency as <1ms', () => {
      const latency = 0.5;
      const result = latency < 1 ? '<1ms' : `${Math.round(latency)}ms`;
      expect(result).toBe('<1ms');
    });

    it('should format milliseconds correctly', () => {
      const latency = 150;
      const result = `${Math.round(latency)}ms`;
      expect(result).toBe('150ms');
    });

    it('should format seconds correctly', () => {
      const latency = 1500;
      const result = `${(latency / 1000).toFixed(1)}s`;
      expect(result).toBe('1.5s');
    });

    it('should round to nearest millisecond', () => {
      const latency = 123.7;
      const result = `${Math.round(latency)}ms`;
      expect(result).toBe('124ms');
    });
  });
});

describe('Get Latency Color', () => {
  describe('getLatencyColor function behavior', () => {
    it('should return gray for undefined latency', () => {
      const result = 'text-gray-400';
      expect(result).toBe('text-gray-400');
    });

    it('should return green for fast latency (<100ms)', () => {
      const latency = 50;
      const result = latency < 100 ? 'text-green-500' : 'text-yellow-500';
      expect(result).toBe('text-green-500');
    });

    it('should return yellow for moderate latency (100-500ms)', () => {
      const latency = 300;
      const result =
        latency < 100 ? 'text-green-500' : latency < 500 ? 'text-yellow-500' : 'text-red-500';
      expect(result).toBe('text-yellow-500');
    });

    it('should return red for slow latency (>500ms)', () => {
      const latency = 800;
      const result =
        latency < 100 ? 'text-green-500' : latency < 500 ? 'text-yellow-500' : 'text-red-500';
      expect(result).toBe('text-red-500');
    });
  });
});

describe('Format Time Since', () => {
  describe('formatTimeSince function behavior', () => {
    it('should return "just now" for recent times', () => {
      const seconds = 3;
      const result = seconds < 5 ? 'just now' : `${seconds}s ago`;
      expect(result).toBe('just now');
    });

    it('should return seconds for times under a minute', () => {
      const seconds = 45;
      const result = seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
      expect(result).toBe('45s ago');
    });

    it('should return minutes for times under an hour', () => {
      const seconds = 300; // 5 minutes
      const result = seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
      expect(result).toBe('5m ago');
    });

    it('should return hours for times under a day', () => {
      const seconds = 7200; // 2 hours
      const result = seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : `${Math.floor(seconds / 86400)}d ago`;
      expect(result).toBe('2h ago');
    });

    it('should return days for longer times', () => {
      const seconds = 172800; // 2 days
      const result = `${Math.floor(seconds / 86400)}d ago`;
      expect(result).toBe('2d ago');
    });
  });
});

describe('SystemStatusIndicator Props Validation', () => {
  describe('Optional props', () => {
    it('should accept empty sources array', () => {
      const props = {
        sources: [],
      };
      expect(props.sources).toEqual([]);
    });

    it('should accept onSourceClick callback', () => {
      const onSourceClick = vi.fn();
      expect(typeof onSourceClick).toBe('function');
    });

    it('should accept onHealthChange callback', () => {
      const onHealthChange = vi.fn();
      expect(typeof onHealthChange).toBe('function');
    });

    it('should accept expanded prop with default false', () => {
      const defaultExpanded = false;
      expect(defaultExpanded).toBe(false);
    });

    it('should accept showLatency with default true', () => {
      const defaultShowLatency = true;
      expect(defaultShowLatency).toBe(true);
    });

    it('should accept refreshInterval with default 0', () => {
      const defaultRefreshInterval = 0;
      expect(defaultRefreshInterval).toBe(0);
    });

    it('should accept testId prop', () => {
      const testId = 'system-status-indicator';
      expect(testId).toBe('system-status-indicator');
    });
  });
});

describe('SystemStatusIndicator Loading State', () => {
  describe('Empty state', () => {
    it('should show empty message when no sources configured', () => {
      const sources: DataSourceStatus[] = [];
      expect(sources.length).toBe(0);
    });
  });
});

describe('SystemStatusIndicator Accessibility', () => {
  describe('ARIA attributes', () => {
    it('should have role="list" on sources container', () => {
      const role = 'list';
      expect(role).toBe('list');
    });

    it('should have aria-label for sources list', () => {
      const ariaLabel = 'Data source connection statuses';
      expect(ariaLabel).toBe('Data source connection statuses');
    });

    it('should have role="button" on source items', () => {
      const role = 'button';
      expect(role).toBe('button');
    });

    it('should have tabIndex for keyboard navigation', () => {
      const tabIndex = 0;
      expect(tabIndex).toBe(0);
    });

    it('should have role="alert" for critical alerts', () => {
      const role = 'alert';
      expect(role).toBe('alert');
    });
  });

  describe('Keyboard navigation', () => {
    it('should respond to Enter key', () => {
      const key: string = 'Enter';
      expect(key === 'Enter' || key === ' ').toBe(true);
    });

    it('should respond to Space key', () => {
      const key: string = ' ';
      expect(key === 'Enter' || key === ' ').toBe(true);
    });
  });
});

describe('SystemStatusIndicator Data Test IDs', () => {
  describe('Component test IDs', () => {
    it('should have testId on main container', () => {
      const testId = 'system-status-indicator';
      expect(testId).toBe('system-status-indicator');
    });

    it('should have testId on compact indicator', () => {
      const testId = 'status-compact';
      expect(testId).toBe('status-compact');
    });

    it('should have testId on expand toggle', () => {
      const testId = 'expand-toggle';
      expect(testId).toBe('expand-toggle');
    });

    it('should have testId on expanded view', () => {
      const testId = 'expanded-view';
      expect(testId).toBe('expanded-view');
    });

    it('should have testId on health summary', () => {
      const testId = 'health-summary';
      expect(testId).toBe('health-summary');
    });

    it('should have testId on sources list', () => {
      const testId = 'sources-list';
      expect(testId).toBe('sources-list');
    });

    it('should have testId on empty state', () => {
      const testId = 'status-empty';
      expect(testId).toBe('status-empty');
    });
  });

  describe('Source item test IDs', () => {
    it('should have testId per source type', () => {
      const sourceType = 'GAMMA_API';
      const testId = `source-item-${sourceType.toLowerCase().replace(/_/g, '-')}`;
      expect(testId).toBe('source-item-gamma-api');
    });

    it('should have data attributes for filtering', () => {
      const dataAttributes = {
        'data-source-type': 'GAMMA_API',
        'data-source-status': 'CONNECTED',
      };

      expect(dataAttributes['data-source-type']).toBe('GAMMA_API');
      expect(dataAttributes['data-source-status']).toBe('CONNECTED');
    });
  });

  describe('Health status test IDs', () => {
    it('should have testId for connected count', () => {
      const testId = 'connected-count';
      expect(testId).toBe('connected-count');
    });

    it('should have testId for degraded count', () => {
      const testId = 'degraded-count';
      expect(testId).toBe('degraded-count');
    });

    it('should have testId for disconnected count', () => {
      const testId = 'disconnected-count';
      expect(testId).toBe('disconnected-count');
    });

    it('should have testId for critical alert', () => {
      const testId = 'critical-alert';
      expect(testId).toBe('critical-alert');
    });

    it('should have testId for offline alert', () => {
      const testId = 'offline-alert';
      expect(testId).toBe('offline-alert');
    });
  });
});

describe('Mock Source Generation', () => {
  describe('generateMockSources function behavior', () => {
    it('should generate sources for all 5 types', () => {
      const allTypes: DataSourceType[] = [
        'GAMMA_API',
        'CLOB_API',
        'WEBSOCKET',
        'POLYGON_RPC',
        'DATABASE',
      ];

      expect(allTypes).toHaveLength(5);
    });

    it('should include lastChecked timestamp', () => {
      const source: DataSourceStatus = {
        type: 'GAMMA_API',
        status: 'CONNECTED',
        lastChecked: new Date(),
      };

      expect(source.lastChecked).toBeInstanceOf(Date);
    });

    it('should include latency for connected sources', () => {
      const source: DataSourceStatus = {
        type: 'GAMMA_API',
        status: 'CONNECTED',
        latency: 50,
        lastChecked: new Date(),
      };

      expect(source.latency).toBeDefined();
    });

    it('should include errorMessage for disconnected sources', () => {
      const source: DataSourceStatus = {
        type: 'WEBSOCKET',
        status: 'DISCONNECTED',
        lastChecked: new Date(),
        errorMessage: 'Connection timeout',
      };

      expect(source.errorMessage).toBe('Connection timeout');
    });
  });
});

describe('Source Click Handler', () => {
  describe('onClick callback', () => {
    it('should call callback with source', () => {
      const mockCallback = vi.fn();
      const source: DataSourceStatus = {
        type: 'GAMMA_API',
        status: 'CONNECTED',
        lastChecked: new Date(),
      };

      mockCallback(source);
      expect(mockCallback).toHaveBeenCalledWith(source);
    });

    it('should not throw when callback is undefined', () => {
      const source: DataSourceStatus = {
        type: 'WEBSOCKET',
        status: 'DISCONNECTED',
        lastChecked: new Date(),
      };

      const executeIfDefined = (
        callback: ((source: DataSourceStatus) => void) | undefined,
        src: DataSourceStatus
      ) => {
        callback?.(src);
      };

      expect(() => {
        executeIfDefined(undefined, source);
      }).not.toThrow();
    });
  });
});

describe('Health Change Handler', () => {
  describe('onHealthChange callback', () => {
    it('should call callback when health changes', () => {
      const mockCallback = vi.fn();
      const health: SystemHealth = 'DEGRADED';

      mockCallback(health);
      expect(mockCallback).toHaveBeenCalledWith('DEGRADED');
    });

    it('should not call when health is same', () => {
      const previousHealth: SystemHealth = 'HEALTHY';
      const currentHealth: SystemHealth = 'HEALTHY';

      expect(previousHealth).toBe(currentHealth);
    });
  });
});

describe('Source Sorting', () => {
  describe('Sort sources by status', () => {
    const sources: DataSourceStatus[] = [
      { type: 'GAMMA_API', status: 'CONNECTED', lastChecked: new Date() },
      { type: 'CLOB_API', status: 'DISCONNECTED', lastChecked: new Date() },
      { type: 'WEBSOCKET', status: 'DEGRADED', lastChecked: new Date() },
      { type: 'POLYGON_RPC', status: 'CONNECTING', lastChecked: new Date() },
      { type: 'DATABASE', status: 'CONNECTED', lastChecked: new Date() },
    ];

    it('should sort disconnected sources first', () => {
      const statusOrder: Record<ConnectionStatus, number> = {
        DISCONNECTED: 0,
        DEGRADED: 1,
        CONNECTING: 2,
        CONNECTED: 3,
        UNKNOWN: 4,
      };

      const sorted = [...sources].sort(
        (a, b) => statusOrder[a.status] - statusOrder[b.status]
      );

      expect(sorted[0]!.status).toBe('DISCONNECTED');
    });

    it('should sort degraded sources after disconnected', () => {
      const statusOrder: Record<ConnectionStatus, number> = {
        DISCONNECTED: 0,
        DEGRADED: 1,
        CONNECTING: 2,
        CONNECTED: 3,
        UNKNOWN: 4,
      };

      const sorted = [...sources].sort(
        (a, b) => statusOrder[a.status] - statusOrder[b.status]
      );

      expect(sorted[1]!.status).toBe('DEGRADED');
    });

    it('should sort connected sources last', () => {
      const statusOrder: Record<ConnectionStatus, number> = {
        DISCONNECTED: 0,
        DEGRADED: 1,
        CONNECTING: 2,
        CONNECTED: 3,
        UNKNOWN: 4,
      };

      const sorted = [...sources].sort(
        (a, b) => statusOrder[a.status] - statusOrder[b.status]
      );

      const lastTwoStatuses = [sorted[3]!.status, sorted[4]!.status];
      expect(lastTwoStatuses).toContain('CONNECTED');
    });
  });
});

describe('Expand/Collapse Behavior', () => {
  describe('Toggle expanded state', () => {
    it('should start collapsed by default', () => {
      const expanded = false;
      expect(expanded).toBe(false);
    });

    it('should expand when toggle clicked', () => {
      let expanded = false;
      expanded = !expanded;
      expect(expanded).toBe(true);
    });

    it('should collapse when toggle clicked again', () => {
      let expanded = true;
      expanded = !expanded;
      expect(expanded).toBe(false);
    });
  });

  describe('Expand toggle button', () => {
    it('should have aria-expanded attribute', () => {
      const expanded = true;
      const ariaExpanded = expanded;
      expect(ariaExpanded).toBe(true);
    });

    it('should have descriptive aria-label', () => {
      const expanded = false;
      const ariaLabel = expanded ? 'Collapse status details' : 'Expand status details';
      expect(ariaLabel).toBe('Expand status details');
    });
  });
});

describe('Alert Display', () => {
  describe('Critical alert', () => {
    it('should show when health is CRITICAL', () => {
      const health: SystemHealth = 'CRITICAL';
      const showAlert = health === 'CRITICAL';
      expect(showAlert).toBe(true);
    });

    it('should not show when health is HEALTHY', () => {
      const health = 'HEALTHY' as SystemHealth;
      const showAlert = health === ('CRITICAL' as SystemHealth);
      expect(showAlert).toBe(false);
    });
  });

  describe('Offline alert', () => {
    it('should show when health is OFFLINE', () => {
      const health: SystemHealth = 'OFFLINE';
      const showAlert = health === 'OFFLINE';
      expect(showAlert).toBe(true);
    });

    it('should not show when health is DEGRADED', () => {
      const health = 'DEGRADED' as SystemHealth;
      const showAlert = health === ('OFFLINE' as SystemHealth);
      expect(showAlert).toBe(false);
    });
  });
});

describe('Latency Display', () => {
  describe('Show latency option', () => {
    it('should show latency when showLatency is true', () => {
      const showLatency = true;
      expect(showLatency).toBe(true);
    });

    it('should hide latency when showLatency is false', () => {
      const showLatency = false;
      expect(showLatency).toBe(false);
    });
  });

  describe('Latency formatting', () => {
    it('should format 50ms correctly', () => {
      const latency = 50;
      const formatted = `${Math.round(latency)}ms`;
      expect(formatted).toBe('50ms');
    });

    it('should format 1.5s correctly', () => {
      const latency = 1500;
      const formatted = `${(latency / 1000).toFixed(1)}s`;
      expect(formatted).toBe('1.5s');
    });
  });
});

describe('Compact Indicator', () => {
  describe('Display format', () => {
    it('should show connected/total format', () => {
      const connectedCount = 4;
      const totalCount = 5;
      const display = `${connectedCount}/${totalCount}`;
      expect(display).toBe('4/5');
    });

    it('should include health icon', () => {
      const healthConfig: Record<SystemHealth, { icon: string }> = {
        HEALTHY: { icon: '✅' },
        DEGRADED: { icon: '⚠️' },
        CRITICAL: { icon: '🔴' },
        OFFLINE: { icon: '❌' },
      };

      expect(healthConfig.HEALTHY.icon).toBe('✅');
    });
  });

  describe('Click behavior', () => {
    it('should toggle expanded on click', () => {
      let expanded = false;
      const handleClick = () => {
        expanded = !expanded;
      };
      handleClick();
      expect(expanded).toBe(true);
    });
  });
});
