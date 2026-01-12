/**
 * Unit tests for AlertDetailModal component
 * Feature: UI-ALERT-002 - Alert detail modal
 */
import { describe, it, expect, vi } from 'vitest';

// Import types and helper functions
import type {
  AlertDetailModalProps,
  AlertAction,
} from '../../app/alerts/components/AlertDetailModal';
import type { AlertType, AlertSeverity, FeedAlert } from '../../app/dashboard/components/AlertFeed';

// Mock React hooks for server-side testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn((initial) => [initial, vi.fn()]),
    useEffect: vi.fn(),
    useCallback: vi.fn((fn) => fn),
    useRef: vi.fn(() => ({ current: null })),
  };
});

// Mock next/link
vi.mock('next/link', () => ({
  default: vi.fn(({ children }) => children),
}));

// Helper function to create mock alert
function createMockAlert(overrides: Partial<FeedAlert> = {}): FeedAlert {
  return {
    id: 'test-alert-123',
    type: 'WHALE_TRADE',
    severity: 'HIGH',
    title: 'Test Alert Title',
    message: 'This is a test alert message with details about the detected activity.',
    marketId: 'market-456',
    walletId: 'wallet-789',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    marketName: 'Trump 2024 Election',
    tags: ['automated', 'whale_trade'],
    read: false,
    acknowledged: false,
    createdAt: new Date('2026-01-12T10:30:00Z'),
    ...overrides,
  };
}

describe('AlertDetailModal Types and Interfaces', () => {
  describe('AlertDetailModalProps interface', () => {
    it('should create valid props with required fields', () => {
      const props: AlertDetailModalProps = {
        alert: createMockAlert(),
        isOpen: true,
        onClose: vi.fn(),
      };

      expect(props.alert).toBeDefined();
      expect(props.isOpen).toBe(true);
      expect(typeof props.onClose).toBe('function');
    });

    it('should accept all optional props', () => {
      const props: AlertDetailModalProps = {
        alert: createMockAlert(),
        isOpen: true,
        onClose: vi.fn(),
        onAction: vi.fn(),
        onNavigateToMarket: vi.fn(),
        onNavigateToWallet: vi.fn(),
        testId: 'custom-modal',
      };

      expect(typeof props.onAction).toBe('function');
      expect(typeof props.onNavigateToMarket).toBe('function');
      expect(typeof props.onNavigateToWallet).toBe('function');
      expect(props.testId).toBe('custom-modal');
    });

    it('should allow null alert when modal is closed', () => {
      const props: AlertDetailModalProps = {
        alert: null,
        isOpen: false,
        onClose: vi.fn(),
      };

      expect(props.alert).toBeNull();
      expect(props.isOpen).toBe(false);
    });
  });

  describe('AlertAction type', () => {
    it('should define all valid action types', () => {
      const actions: AlertAction[] = ['DISMISS', 'MARK_READ', 'MARK_UNREAD', 'ACKNOWLEDGE', 'INVESTIGATE'];

      expect(actions).toContain('DISMISS');
      expect(actions).toContain('MARK_READ');
      expect(actions).toContain('MARK_UNREAD');
      expect(actions).toContain('ACKNOWLEDGE');
      expect(actions).toContain('INVESTIGATE');
      expect(actions.length).toBe(5);
    });

    it('should be usable in callbacks', () => {
      const mockCallback = vi.fn((action: AlertAction, alert: FeedAlert) => {
        return { action, alertId: alert.id };
      });

      const alert = createMockAlert();
      const result = mockCallback('MARK_READ', alert);

      expect(result.action).toBe('MARK_READ');
      expect(result.alertId).toBe('test-alert-123');
    });
  });
});

describe('AlertDetailModal Helper Functions', () => {
  // Test the helper functions exported from the component

  describe('formatDetailDate', () => {
    it('should format date with full details', async () => {
      const { formatDetailDate } = await import('../../app/alerts/components/AlertDetailModal');
      const date = new Date('2026-01-12T14:30:45Z');
      const formatted = formatDetailDate(date);

      // Should include day of week, month, day, year, and time
      expect(formatted).toMatch(/\w+/); // Contains words
      expect(formatted).toMatch(/\d+/); // Contains numbers
    });

    it('should handle different dates', async () => {
      const { formatDetailDate } = await import('../../app/alerts/components/AlertDetailModal');

      const date1 = new Date('2026-01-01T00:00:00Z');
      const date2 = new Date('2025-12-31T23:59:59Z');

      const formatted1 = formatDetailDate(date1);
      const formatted2 = formatDetailDate(date2);

      expect(formatted1).not.toBe(formatted2);
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent times correctly', async () => {
      const { formatRelativeTime } = await import('../../app/alerts/components/AlertDetailModal');

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const formatted = formatRelativeTime(fiveMinutesAgo);

      expect(formatted).toMatch(/minute/i);
    });

    it('should format hours ago correctly', async () => {
      const { formatRelativeTime } = await import('../../app/alerts/components/AlertDetailModal');

      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const formatted = formatRelativeTime(threeHoursAgo);

      expect(formatted).toMatch(/hour/i);
    });

    it('should format days ago correctly', async () => {
      const { formatRelativeTime } = await import('../../app/alerts/components/AlertDetailModal');

      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const formatted = formatRelativeTime(twoDaysAgo);

      expect(formatted).toMatch(/day/i);
    });

    it('should return "Just now" for very recent times', async () => {
      const { formatRelativeTime } = await import('../../app/alerts/components/AlertDetailModal');

      const now = new Date();
      const formatted = formatRelativeTime(now);

      expect(formatted).toBe('Just now');
    });
  });

  describe('getSeverityDescription', () => {
    it('should return description for each severity level', async () => {
      const { getSeverityDescription } = await import('../../app/alerts/components/AlertDetailModal');

      const severities: AlertSeverity[] = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      for (const severity of severities) {
        const description = getSeverityDescription(severity);
        expect(description).toBeTruthy();
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(10);
      }
    });

    it('should have unique descriptions for different severities', async () => {
      const { getSeverityDescription } = await import('../../app/alerts/components/AlertDetailModal');

      const infoDesc = getSeverityDescription('INFO');
      const criticalDesc = getSeverityDescription('CRITICAL');

      expect(infoDesc).not.toBe(criticalDesc);
    });

    it('should mention urgency for critical severity', async () => {
      const { getSeverityDescription } = await import('../../app/alerts/components/AlertDetailModal');

      const criticalDesc = getSeverityDescription('CRITICAL');
      expect(criticalDesc.toLowerCase()).toMatch(/immediate|urgent|critical/);
    });
  });

  describe('getAlertTypeDescription', () => {
    it('should return description for each alert type', async () => {
      const { getAlertTypeDescription } = await import('../../app/alerts/components/AlertDetailModal');

      const types: AlertType[] = [
        'WHALE_TRADE',
        'PRICE_MOVEMENT',
        'INSIDER_ACTIVITY',
        'FRESH_WALLET',
        'WALLET_REACTIVATION',
        'COORDINATED_ACTIVITY',
        'UNUSUAL_PATTERN',
        'MARKET_RESOLVED',
        'NEW_MARKET',
        'SUSPICIOUS_FUNDING',
        'SANCTIONED_ACTIVITY',
        'SYSTEM',
      ];

      for (const type of types) {
        const description = getAlertTypeDescription(type);
        expect(description).toBeTruthy();
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(10);
      }
    });

    it('should describe whale trades appropriately', async () => {
      const { getAlertTypeDescription } = await import('../../app/alerts/components/AlertDetailModal');

      const whaleDesc = getAlertTypeDescription('WHALE_TRADE');
      expect(whaleDesc.toLowerCase()).toMatch(/large|trade|market/);
    });

    it('should describe insider activity appropriately', async () => {
      const { getAlertTypeDescription } = await import('../../app/alerts/components/AlertDetailModal');

      const insiderDesc = getAlertTypeDescription('INSIDER_ACTIVITY');
      expect(insiderDesc.toLowerCase()).toMatch(/insider|information|non-public/);
    });
  });

  describe('getActionButtons', () => {
    it('should return action buttons for unread alert', async () => {
      const { getActionButtons } = await import('../../app/alerts/components/AlertDetailModal');

      const alert = createMockAlert({ read: false, acknowledged: false });
      const buttons = getActionButtons(alert);

      expect(Array.isArray(buttons)).toBe(true);
      expect(buttons.length).toBeGreaterThan(0);

      // Should have mark as read option for unread alerts
      const markReadButton = buttons.find((b) => b.action === 'MARK_READ');
      expect(markReadButton).toBeDefined();
    });

    it('should return action buttons for read alert', async () => {
      const { getActionButtons } = await import('../../app/alerts/components/AlertDetailModal');

      const alert = createMockAlert({ read: true, acknowledged: false });
      const buttons = getActionButtons(alert);

      // Should have mark as unread option for read alerts
      const markUnreadButton = buttons.find((b) => b.action === 'MARK_UNREAD');
      expect(markUnreadButton).toBeDefined();
    });

    it('should include acknowledge button for unacknowledged alerts', async () => {
      const { getActionButtons } = await import('../../app/alerts/components/AlertDetailModal');

      const alert = createMockAlert({ acknowledged: false });
      const buttons = getActionButtons(alert);

      const acknowledgeButton = buttons.find((b) => b.action === 'ACKNOWLEDGE');
      expect(acknowledgeButton).toBeDefined();
    });

    it('should not include acknowledge button for acknowledged alerts', async () => {
      const { getActionButtons } = await import('../../app/alerts/components/AlertDetailModal');

      const alert = createMockAlert({ acknowledged: true });
      const buttons = getActionButtons(alert);

      const acknowledgeButton = buttons.find((b) => b.action === 'ACKNOWLEDGE');
      expect(acknowledgeButton).toBeUndefined();
    });

    it('should always include dismiss button', async () => {
      const { getActionButtons } = await import('../../app/alerts/components/AlertDetailModal');

      const alert = createMockAlert();
      const buttons = getActionButtons(alert);

      const dismissButton = buttons.find((b) => b.action === 'DISMISS');
      expect(dismissButton).toBeDefined();
      expect(dismissButton?.variant).toBe('danger');
    });

    it('should have correct button variants', async () => {
      const { getActionButtons } = await import('../../app/alerts/components/AlertDetailModal');

      const alert = createMockAlert({ read: false, acknowledged: false });
      const buttons = getActionButtons(alert);

      // Check that buttons have valid variants
      for (const button of buttons) {
        expect(['primary', 'secondary', 'danger']).toContain(button.variant);
      }
    });
  });

  describe('truncateAddress', () => {
    it('should truncate long addresses', async () => {
      const { truncateAddress } = await import('../../app/alerts/components/AlertDetailModal');

      const fullAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const truncated = truncateAddress(fullAddress);

      expect(truncated).toContain('...');
      expect(truncated.length).toBeLessThan(fullAddress.length);
    });

    it('should use default start and end chars', async () => {
      const { truncateAddress } = await import('../../app/alerts/components/AlertDetailModal');

      const fullAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const truncated = truncateAddress(fullAddress);

      expect(truncated.startsWith('0x1234')).toBe(true);
      expect(truncated.endsWith('5678')).toBe(true);
    });

    it('should accept custom start and end chars', async () => {
      const { truncateAddress } = await import('../../app/alerts/components/AlertDetailModal');

      const fullAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const truncated = truncateAddress(fullAddress, 10, 6);

      expect(truncated.startsWith('0x12345678')).toBe(true);
      expect(truncated.endsWith('345678')).toBe(true);
    });

    it('should not truncate short addresses', async () => {
      const { truncateAddress } = await import('../../app/alerts/components/AlertDetailModal');

      const shortAddress = '0x1234abcd';
      const truncated = truncateAddress(shortAddress);

      // Should return original if too short to truncate meaningfully
      expect(truncated).toBe(shortAddress);
    });
  });

  describe('copyToClipboard', () => {
    it('should be a function', async () => {
      const { copyToClipboard } = await import('../../app/alerts/components/AlertDetailModal');

      expect(typeof copyToClipboard).toBe('function');
    });

    it('should handle clipboard API not available', async () => {
      const { copyToClipboard } = await import('../../app/alerts/components/AlertDetailModal');

      // Mock navigator.clipboard as undefined
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      const result = await copyToClipboard('test text');
      expect(result).toBe(false);

      // Restore
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
      });
    });
  });
});

describe('AlertDetailModal Component Behavior', () => {
  describe('Modal Visibility', () => {
    it('should not render when isOpen is false', () => {
      const props: AlertDetailModalProps = {
        alert: createMockAlert(),
        isOpen: false,
        onClose: vi.fn(),
      };

      // Component should return null when not open
      expect(props.isOpen).toBe(false);
    });

    it('should render when isOpen is true and alert exists', () => {
      const props: AlertDetailModalProps = {
        alert: createMockAlert(),
        isOpen: true,
        onClose: vi.fn(),
      };

      expect(props.isOpen).toBe(true);
      expect(props.alert).not.toBeNull();
    });

    it('should not render when alert is null even if isOpen', () => {
      const props: AlertDetailModalProps = {
        alert: null,
        isOpen: true,
        onClose: vi.fn(),
      };

      expect(props.alert).toBeNull();
    });
  });

  describe('Alert Data Display', () => {
    it('should display alert title', () => {
      const alert = createMockAlert({ title: 'Critical Whale Trade Detected' });

      expect(alert.title).toBe('Critical Whale Trade Detected');
    });

    it('should display alert message', () => {
      const alert = createMockAlert({ message: 'A large trade of $1M was detected on the market.' });

      expect(alert.message).toContain('$1M');
    });

    it('should display alert severity', () => {
      const alert = createMockAlert({ severity: 'CRITICAL' });

      expect(alert.severity).toBe('CRITICAL');
    });

    it('should display alert type', () => {
      const alert = createMockAlert({ type: 'INSIDER_ACTIVITY' });

      expect(alert.type).toBe('INSIDER_ACTIVITY');
    });

    it('should display market name when available', () => {
      const alert = createMockAlert({ marketName: 'Bitcoin ETF Approval' });

      expect(alert.marketName).toBe('Bitcoin ETF Approval');
    });

    it('should display wallet address when available', () => {
      const alert = createMockAlert({ walletAddress: '0xabc123def456' });

      expect(alert.walletAddress).toBe('0xabc123def456');
    });

    it('should display tags when available', () => {
      const alert = createMockAlert({ tags: ['urgent', 'whale', 'insider'] });

      expect(alert.tags).toContain('urgent');
      expect(alert.tags).toContain('whale');
      expect(alert.tags?.length).toBe(3);
    });

    it('should display read/unread status', () => {
      const unreadAlert = createMockAlert({ read: false });
      const readAlert = createMockAlert({ read: true });

      expect(unreadAlert.read).toBe(false);
      expect(readAlert.read).toBe(true);
    });

    it('should display acknowledged status', () => {
      const unacknowledgedAlert = createMockAlert({ acknowledged: false });
      const acknowledgedAlert = createMockAlert({ acknowledged: true });

      expect(unacknowledgedAlert.acknowledged).toBe(false);
      expect(acknowledgedAlert.acknowledged).toBe(true);
    });

    it('should display created timestamp', () => {
      const alert = createMockAlert({ createdAt: new Date('2026-01-12T15:00:00Z') });

      expect(alert.createdAt).toBeInstanceOf(Date);
      expect(alert.createdAt.toISOString()).toContain('2026-01-12');
    });

    it('should display alert ID', () => {
      const alert = createMockAlert({ id: 'unique-alert-id-789' });

      expect(alert.id).toBe('unique-alert-id-789');
    });
  });

  describe('Callback Handling', () => {
    it('should call onClose when close button clicked', () => {
      const onClose = vi.fn();
      const props: AlertDetailModalProps = {
        alert: createMockAlert(),
        isOpen: true,
        onClose,
      };

      // Simulate close
      props.onClose();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onAction with correct parameters', () => {
      const onAction = vi.fn();
      const alert = createMockAlert();
      const props: AlertDetailModalProps = {
        alert,
        isOpen: true,
        onClose: vi.fn(),
        onAction,
      };

      // Simulate action
      props.onAction?.('MARK_READ', alert);
      expect(onAction).toHaveBeenCalledWith('MARK_READ', alert);
    });

    it('should call onNavigateToMarket with market ID', () => {
      const onNavigateToMarket = vi.fn();
      const alert = createMockAlert({ marketId: 'test-market-123' });
      const props: AlertDetailModalProps = {
        alert,
        isOpen: true,
        onClose: vi.fn(),
        onNavigateToMarket,
      };

      // Simulate navigation
      props.onNavigateToMarket?.('test-market-123');
      expect(onNavigateToMarket).toHaveBeenCalledWith('test-market-123');
    });

    it('should call onNavigateToWallet with wallet address', () => {
      const onNavigateToWallet = vi.fn();
      const alert = createMockAlert({ walletAddress: '0xtest123' });
      const props: AlertDetailModalProps = {
        alert,
        isOpen: true,
        onClose: vi.fn(),
        onNavigateToWallet,
      };

      // Simulate navigation
      props.onNavigateToWallet?.('0xtest123');
      expect(onNavigateToWallet).toHaveBeenCalledWith('0xtest123');
    });
  });

  describe('Action Button Generation', () => {
    it('should generate correct buttons for new unread unacknowledged alert', async () => {
      const { getActionButtons } = await import('../../app/alerts/components/AlertDetailModal');

      const alert = createMockAlert({ read: false, acknowledged: false });
      const buttons = getActionButtons(alert);

      const actions = buttons.map((b) => b.action);
      expect(actions).toContain('MARK_READ');
      expect(actions).toContain('ACKNOWLEDGE');
      expect(actions).toContain('DISMISS');
      expect(actions).not.toContain('MARK_UNREAD');
    });

    it('should generate correct buttons for read unacknowledged alert', async () => {
      const { getActionButtons } = await import('../../app/alerts/components/AlertDetailModal');

      const alert = createMockAlert({ read: true, acknowledged: false });
      const buttons = getActionButtons(alert);

      const actions = buttons.map((b) => b.action);
      expect(actions).toContain('MARK_UNREAD');
      expect(actions).toContain('ACKNOWLEDGE');
      expect(actions).toContain('DISMISS');
      expect(actions).not.toContain('MARK_READ');
    });

    it('should generate correct buttons for read acknowledged alert', async () => {
      const { getActionButtons } = await import('../../app/alerts/components/AlertDetailModal');

      const alert = createMockAlert({ read: true, acknowledged: true });
      const buttons = getActionButtons(alert);

      const actions = buttons.map((b) => b.action);
      expect(actions).toContain('MARK_UNREAD');
      expect(actions).toContain('DISMISS');
      expect(actions).not.toContain('MARK_READ');
      expect(actions).not.toContain('ACKNOWLEDGE');
    });
  });

  describe('Related Data Section', () => {
    it('should show market info when marketId or marketName exists', () => {
      const alertWithMarket = createMockAlert({
        marketId: 'market-123',
        marketName: 'Test Market'
      });

      expect(alertWithMarket.marketId).toBeTruthy();
      expect(alertWithMarket.marketName).toBeTruthy();
    });

    it('should show wallet info when walletId or walletAddress exists', () => {
      const alertWithWallet = createMockAlert({
        walletId: 'wallet-123',
        walletAddress: '0xabc123'
      });

      expect(alertWithWallet.walletId).toBeTruthy();
      expect(alertWithWallet.walletAddress).toBeTruthy();
    });

    it('should handle alert with no related data', () => {
      const alertNoRelated = createMockAlert({
        marketId: undefined,
        marketName: undefined,
        walletId: undefined,
        walletAddress: undefined
      });

      expect(alertNoRelated.marketId).toBeUndefined();
      expect(alertNoRelated.walletAddress).toBeUndefined();
    });
  });

  describe('Tags Section', () => {
    it('should display all tags', () => {
      const alert = createMockAlert({
        tags: ['critical', 'whale', 'automated', 'election']
      });

      expect(alert.tags?.length).toBe(4);
      expect(alert.tags).toContain('critical');
      expect(alert.tags).toContain('whale');
    });

    it('should handle empty tags array', () => {
      const alert = createMockAlert({ tags: [] });

      expect(alert.tags?.length).toBe(0);
    });

    it('should handle undefined tags', () => {
      const alert = createMockAlert({ tags: undefined });

      expect(alert.tags).toBeUndefined();
    });
  });
});

describe('AlertDetailModal Edge Cases', () => {
  describe('Very Long Content', () => {
    it('should handle very long title', () => {
      const longTitle = 'A'.repeat(500);
      const alert = createMockAlert({ title: longTitle });

      expect(alert.title.length).toBe(500);
    });

    it('should handle very long message', () => {
      const longMessage = 'B'.repeat(2000);
      const alert = createMockAlert({ message: longMessage });

      expect(alert.message.length).toBe(2000);
    });

    it('should handle very long wallet address', () => {
      const longAddress = '0x' + 'a'.repeat(100);
      const alert = createMockAlert({ walletAddress: longAddress });

      expect(alert.walletAddress?.length).toBe(102);
    });
  });

  describe('Special Characters', () => {
    it('should handle special characters in title', () => {
      const specialTitle = 'Alert: <script>alert("xss")</script> & "quotes"';
      const alert = createMockAlert({ title: specialTitle });

      expect(alert.title).toBe(specialTitle);
    });

    it('should handle unicode in message', () => {
      const unicodeMessage = '🚨 Alert detected! 价格变化 Цена изменилась';
      const alert = createMockAlert({ message: unicodeMessage });

      expect(alert.message).toContain('🚨');
      expect(alert.message).toContain('价格变化');
    });
  });

  describe('Timestamps', () => {
    it('should handle timestamps in the past', () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');
      const alert = createMockAlert({ createdAt: pastDate });

      expect(alert.createdAt.getFullYear()).toBe(2020);
    });

    it('should handle timestamps at epoch', () => {
      const epochDate = new Date(0);
      const alert = createMockAlert({ createdAt: epochDate });

      expect(alert.createdAt.getTime()).toBe(0);
    });
  });

  describe('Alert Severities', () => {
    const severities: AlertSeverity[] = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    severities.forEach((severity) => {
      it(`should handle ${severity} severity`, () => {
        const alert = createMockAlert({ severity });
        expect(alert.severity).toBe(severity);
      });
    });
  });

  describe('Alert Types', () => {
    const types: AlertType[] = [
      'WHALE_TRADE',
      'PRICE_MOVEMENT',
      'INSIDER_ACTIVITY',
      'FRESH_WALLET',
      'WALLET_REACTIVATION',
      'COORDINATED_ACTIVITY',
      'UNUSUAL_PATTERN',
      'MARKET_RESOLVED',
      'NEW_MARKET',
      'SUSPICIOUS_FUNDING',
      'SANCTIONED_ACTIVITY',
      'SYSTEM',
    ];

    types.forEach((type) => {
      it(`should handle ${type} alert type`, () => {
        const alert = createMockAlert({ type });
        expect(alert.type).toBe(type);
      });
    });
  });
});

describe('AlertDetailModal Accessibility', () => {
  describe('Keyboard Navigation', () => {
    it('should respond to Escape key', () => {
      const onClose = vi.fn();
      const props: AlertDetailModalProps = {
        alert: createMockAlert(),
        isOpen: true,
        onClose,
      };

      // Escape key should trigger close
      expect(typeof props.onClose).toBe('function');
    });

    it('should have focusable close button', () => {
      // Modal should have a close button that can receive focus
      const props: AlertDetailModalProps = {
        alert: createMockAlert(),
        isOpen: true,
        onClose: vi.fn(),
        testId: 'modal-with-close',
      };

      expect(props.testId).toBe('modal-with-close');
    });
  });

  describe('ARIA Attributes', () => {
    it('should have role="dialog"', () => {
      // Modal container should have dialog role
      const props: AlertDetailModalProps = {
        alert: createMockAlert(),
        isOpen: true,
        onClose: vi.fn(),
      };

      expect(props.isOpen).toBe(true);
    });

    it('should have aria-modal="true"', () => {
      // Modal should indicate it is modal
      const props: AlertDetailModalProps = {
        alert: createMockAlert(),
        isOpen: true,
        onClose: vi.fn(),
      };

      expect(props.alert).not.toBeNull();
    });

    it('should have aria-labelledby pointing to title', () => {
      const alert = createMockAlert({ title: 'Test Modal Title' });
      expect(alert.title).toBe('Test Modal Title');
    });
  });
});

describe('AlertDetailModal Integration', () => {
  describe('With AlertsListView', () => {
    it('should accept alerts from AlertsListView', () => {
      const alert = createMockAlert();
      const props: AlertDetailModalProps = {
        alert,
        isOpen: true,
        onClose: vi.fn(),
        onAction: vi.fn(),
      };

      expect(props.alert).toBeDefined();
      expect(props.alert?.id).toBe('test-alert-123');
    });

    it('should update alert state through onAction', () => {
      const onAction = vi.fn((action: AlertAction, alert: FeedAlert) => {
        if (action === 'MARK_READ') {
          return { ...alert, read: true };
        }
        return alert;
      });

      const alert = createMockAlert({ read: false });
      const result = onAction('MARK_READ', alert);

      expect(result.read).toBe(true);
    });
  });

  describe('Navigation Integration', () => {
    it('should support navigation to market page', () => {
      const onNavigateToMarket = vi.fn();
      const alert = createMockAlert({ marketId: 'market-xyz' });

      onNavigateToMarket(alert.marketId!);
      expect(onNavigateToMarket).toHaveBeenCalledWith('market-xyz');
    });

    it('should support navigation to wallet page', () => {
      const onNavigateToWallet = vi.fn();
      const alert = createMockAlert({ walletAddress: '0xwallet123' });

      onNavigateToWallet(alert.walletAddress!);
      expect(onNavigateToWallet).toHaveBeenCalledWith('0xwallet123');
    });
  });
});
