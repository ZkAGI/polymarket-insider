'use client';

import { useState } from 'react';
import SettingsLayout from './components/SettingsLayout';
import SettingsCategory from './components/SettingsCategory';
import SettingsSection from './components/SettingsSection';
import ThemeToggle from '../dashboard/components/ThemeToggle';

export interface AlertThresholds {
  volumeSpike: number; // percentage increase
  whaleTradeMinimum: number; // USD
  suspicionScore: number; // 0-100
  priceChange: number; // percentage
}

export interface NotificationSettings {
  email: {
    enabled: boolean;
    address: string;
  };
  push: {
    enabled: boolean;
  };
  sms: {
    enabled: boolean;
    phoneNumber: string;
  };
  frequency: 'realtime' | 'hourly' | 'daily';
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface DisplaySettings {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  showAdvancedMetrics: boolean;
  defaultTimeRange: '1h' | '24h' | '7d' | '30d';
}

export interface PrivacySettings {
  shareAnalytics: boolean;
  cookiesEnabled: boolean;
}

export interface Settings {
  alertThresholds: AlertThresholds;
  notifications: NotificationSettings;
  display: DisplaySettings;
  privacy: PrivacySettings;
}

const defaultSettings: Settings = {
  alertThresholds: {
    volumeSpike: 200,
    whaleTradeMinimum: 100000,
    suspicionScore: 75,
    priceChange: 10,
  },
  notifications: {
    email: {
      enabled: true,
      address: 'user@example.com',
    },
    push: {
      enabled: false,
    },
    sms: {
      enabled: false,
      phoneNumber: '',
    },
    frequency: 'realtime',
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
  },
  display: {
    theme: 'system',
    compactMode: false,
    showAdvancedMetrics: true,
    defaultTimeRange: '24h',
  },
  privacy: {
    shareAnalytics: false,
    cookiesEnabled: true,
  },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const updateSettings = <K extends keyof Settings>(category: K, updates: Partial<Settings[K]>) => {
    setSettings((prev) => ({
      ...prev,
      [category]: { ...prev[category], ...updates },
    }));
    setHasChanges(true);
    setSaveMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // In a real app, this would save to backend
      console.log('Saving settings:', settings);

      setHasChanges(false);
      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      setSettings(defaultSettings);
      setHasChanges(true);
      setSaveMessage(null);
    }
  };

  return (
    <SettingsLayout
      title="Settings"
      description="Configure your Polymarket Tracker preferences"
      hasChanges={hasChanges}
      isSaving={isSaving}
      saveMessage={saveMessage}
      onSave={handleSave}
      onReset={handleReset}
    >
      {/* Alert Thresholds */}
      <SettingsCategory
        id="alert-thresholds"
        title="Alert Thresholds"
        description="Configure when alerts should be triggered"
      >
        <SettingsSection title="Volume Spike Threshold">
          <div className="space-y-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Minimum volume increase to trigger alert (%)
            </label>
            <input
              type="number"
              min="0"
              max="1000"
              value={settings.alertThresholds.volumeSpike}
              onChange={(e) =>
                updateSettings('alertThresholds', { volumeSpike: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="volume-spike-input"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Alert when market volume increases by more than this percentage
            </p>
          </div>
        </SettingsSection>

        <SettingsSection title="Whale Trade Minimum">
          <div className="space-y-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Minimum trade size for whale detection (USD)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={settings.alertThresholds.whaleTradeMinimum}
              onChange={(e) =>
                updateSettings('alertThresholds', { whaleTradeMinimum: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="whale-trade-input"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Trades above this amount will be flagged as whale trades
            </p>
          </div>
        </SettingsSection>

        <SettingsSection title="Suspicion Score Threshold">
          <div className="space-y-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Minimum suspicion score to alert (0-100)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.alertThresholds.suspicionScore}
              onChange={(e) =>
                updateSettings('alertThresholds', { suspicionScore: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="suspicion-score-input"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Alert for wallets with suspicion scores above this threshold
            </p>
          </div>
        </SettingsSection>

        <SettingsSection title="Price Change Threshold">
          <div className="space-y-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Significant price change percentage (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.alertThresholds.priceChange}
              onChange={(e) =>
                updateSettings('alertThresholds', { priceChange: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="price-change-input"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Alert when market price moves by more than this percentage
            </p>
          </div>
        </SettingsSection>
      </SettingsCategory>

      {/* Notification Settings */}
      <SettingsCategory
        id="notifications"
        title="Notifications"
        description="Choose how and when you receive alerts"
      >
        <SettingsSection title="Email Notifications">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700 dark:text-gray-300">Enable email notifications</label>
              <input
                type="checkbox"
                checked={settings.notifications.email.enabled}
                onChange={(e) =>
                  updateSettings('notifications', {
                    email: { ...settings.notifications.email, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                data-testid="email-enabled-checkbox"
              />
            </div>
            {settings.notifications.email.enabled && (
              <div className="space-y-2">
                <label className="block text-sm text-gray-700 dark:text-gray-300">Email address</label>
                <input
                  type="email"
                  value={settings.notifications.email.address}
                  onChange={(e) =>
                    updateSettings('notifications', {
                      email: { ...settings.notifications.email, address: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  data-testid="email-address-input"
                />
              </div>
            )}
          </div>
        </SettingsSection>

        <SettingsSection title="Push Notifications">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700 dark:text-gray-300">Enable push notifications</label>
            <input
              type="checkbox"
              checked={settings.notifications.push.enabled}
              onChange={(e) =>
                updateSettings('notifications', {
                  push: { enabled: e.target.checked },
                })
              }
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              data-testid="push-enabled-checkbox"
            />
          </div>
        </SettingsSection>

        <SettingsSection title="SMS Notifications">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700 dark:text-gray-300">Enable SMS notifications</label>
              <input
                type="checkbox"
                checked={settings.notifications.sms.enabled}
                onChange={(e) =>
                  updateSettings('notifications', {
                    sms: { ...settings.notifications.sms, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                data-testid="sms-enabled-checkbox"
              />
            </div>
            {settings.notifications.sms.enabled && (
              <div className="space-y-2">
                <label className="block text-sm text-gray-700 dark:text-gray-300">Phone number</label>
                <input
                  type="tel"
                  value={settings.notifications.sms.phoneNumber}
                  onChange={(e) =>
                    updateSettings('notifications', {
                      sms: { ...settings.notifications.sms, phoneNumber: e.target.value },
                    })
                  }
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  data-testid="sms-phone-input"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Include country code (e.g., +1 for US)
                </p>
              </div>
            )}
          </div>
        </SettingsSection>

        <SettingsSection title="Notification Frequency">
          <div className="space-y-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300">How often to receive notifications</label>
            <select
              value={settings.notifications.frequency}
              onChange={(e) =>
                updateSettings('notifications', {
                  frequency: e.target.value as NotificationSettings['frequency'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="frequency-select"
            >
              <option value="realtime">Real-time (as they happen)</option>
              <option value="hourly">Hourly digest</option>
              <option value="daily">Daily summary</option>
            </select>
          </div>
        </SettingsSection>

        <SettingsSection title="Quiet Hours">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700 dark:text-gray-300">Enable quiet hours</label>
              <input
                type="checkbox"
                checked={settings.notifications.quietHours.enabled}
                onChange={(e) =>
                  updateSettings('notifications', {
                    quietHours: { ...settings.notifications.quietHours, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                data-testid="quiet-hours-enabled-checkbox"
              />
            </div>
            {settings.notifications.quietHours.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm text-gray-700 dark:text-gray-300">Start time</label>
                  <input
                    type="time"
                    value={settings.notifications.quietHours.startTime}
                    onChange={(e) =>
                      updateSettings('notifications', {
                        quietHours: { ...settings.notifications.quietHours, startTime: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    data-testid="quiet-hours-start-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm text-gray-700 dark:text-gray-300">End time</label>
                  <input
                    type="time"
                    value={settings.notifications.quietHours.endTime}
                    onChange={(e) =>
                      updateSettings('notifications', {
                        quietHours: { ...settings.notifications.quietHours, endTime: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    data-testid="quiet-hours-end-input"
                  />
                </div>
              </div>
            )}
          </div>
        </SettingsSection>
      </SettingsCategory>

      {/* Display Settings */}
      <SettingsCategory
        id="display"
        title="Display"
        description="Customize your viewing experience"
      >
        <SettingsSection title="Theme">
          <div className="space-y-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300">Color scheme</label>
            <ThemeToggle
              mode="dropdown"
              size="md"
              showLabel={true}
              showSystemOption={true}
              dropdownPosition="left"
              testId="theme-toggle"
            />
          </div>
        </SettingsSection>

        <SettingsSection title="Layout">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Compact mode</label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reduce spacing for more content</p>
              </div>
              <input
                type="checkbox"
                checked={settings.display.compactMode}
                onChange={(e) =>
                  updateSettings('display', { compactMode: e.target.checked })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                data-testid="compact-mode-checkbox"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Show advanced metrics</label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Display technical trading indicators</p>
              </div>
              <input
                type="checkbox"
                checked={settings.display.showAdvancedMetrics}
                onChange={(e) =>
                  updateSettings('display', { showAdvancedMetrics: e.target.checked })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                data-testid="advanced-metrics-checkbox"
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Default Time Range">
          <div className="space-y-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300">Default chart time range</label>
            <select
              value={settings.display.defaultTimeRange}
              onChange={(e) =>
                updateSettings('display', {
                  defaultTimeRange: e.target.value as DisplaySettings['defaultTimeRange'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="time-range-select"
            >
              <option value="1h">1 Hour</option>
              <option value="24h">24 Hours</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
            </select>
          </div>
        </SettingsSection>
      </SettingsCategory>

      {/* Privacy Settings */}
      <SettingsCategory
        id="privacy"
        title="Privacy"
        description="Control your data and privacy preferences"
      >
        <SettingsSection title="Data Collection">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Share usage analytics</label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Help us improve by sharing anonymous usage data</p>
              </div>
              <input
                type="checkbox"
                checked={settings.privacy.shareAnalytics}
                onChange={(e) =>
                  updateSettings('privacy', { shareAnalytics: e.target.checked })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                data-testid="analytics-checkbox"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Enable cookies</label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Required for full functionality</p>
              </div>
              <input
                type="checkbox"
                checked={settings.privacy.cookiesEnabled}
                onChange={(e) =>
                  updateSettings('privacy', { cookiesEnabled: e.target.checked })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                data-testid="cookies-checkbox"
              />
            </div>
          </div>
        </SettingsSection>
      </SettingsCategory>
    </SettingsLayout>
  );
}
