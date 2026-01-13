/**
 * Daily digest email template
 * Generates HTML and plain text emails for daily summary notifications
 * Uses email-safe HTML/CSS that works across major email clients
 */

import {
  DailyDigestData,
  DigestEmailOptions,
  DigestAlertSummary,
  DigestWalletSummary,
  DigestMarketSummary,
  DigestHighlight,
  DEFAULT_DIGEST_OPTIONS,
} from './digest-types';
import {
  RenderedEmail,
  AlertSeverity,
} from './types';
import {
  formatEmailDate,
  formatCurrency,
  formatPercentage,
  truncateAddress,
  escapeHtml,
  getSeverityLabel,
  SEVERITY_COLORS,
  ALERT_TYPE_CONFIG,
} from './alert-template';

/**
 * Format a date for digest display (short format)
 */
export function formatDigestDate(
  date: Date,
  locale?: string,
  timezone?: string
): string {
  const effectiveLocale = locale || 'en-US';
  const effectiveTimezone = timezone || 'UTC';
  try {
    return date.toLocaleDateString(effectiveLocale, {
      timeZone: effectiveTimezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    const iso = date.toISOString();
    const datePart = iso.split('T')[0];
    return datePart ?? iso.substring(0, 10);
  }
}

/**
 * Format a time for digest display
 */
export function formatDigestTime(
  date: Date,
  locale?: string,
  timezone?: string
): string {
  const effectiveLocale = locale || 'en-US';
  const effectiveTimezone = timezone || 'UTC';
  try {
    return date.toLocaleTimeString(effectiveLocale, {
      timeZone: effectiveTimezone,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    const iso = date.toISOString();
    const timePart = iso.split('T')[1];
    return timePart ? timePart.substring(0, 5) : iso.substring(11, 16);
  }
}

/**
 * Format a number with compact notation
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Get trend icon and color based on change
 */
export function getTrendIndicator(change: number): { icon: string; color: string } {
  if (change > 10) {
    return { icon: '↑↑', color: '#16a34a' };
  }
  if (change > 0) {
    return { icon: '↑', color: '#22c55e' };
  }
  if (change < -10) {
    return { icon: '↓↓', color: '#dc2626' };
  }
  if (change < 0) {
    return { icon: '↓', color: '#ef4444' };
  }
  return { icon: '→', color: '#6b7280' };
}

/**
 * Generate subject line for digest email
 */
export function generateDigestSubject(data: DailyDigestData): string {
  const dateStr = formatDigestDate(data.digestDate, 'en-US', data.timezone || 'UTC');
  const alertSuffix = data.alertCounts.critical > 0
    ? ` - ${data.alertCounts.critical} Critical Alert${data.alertCounts.critical > 1 ? 's' : ''}`
    : '';
  return `Daily Digest: ${dateStr}${alertSuffix}`;
}

/**
 * Generate HTML for alert counts summary
 */
function generateAlertCountsHtml(data: DailyDigestData): string {
  const counts = data.alertCounts;

  const severityBadges = [
    { severity: 'critical' as AlertSeverity, count: counts.critical },
    { severity: 'high' as AlertSeverity, count: counts.high },
    { severity: 'medium' as AlertSeverity, count: counts.medium },
    { severity: 'low' as AlertSeverity, count: counts.low },
    { severity: 'info' as AlertSeverity, count: counts.info },
  ].filter(s => s.count > 0);

  if (severityBadges.length === 0) {
    return `
      <td style="padding: 16px; text-align: center;">
        <p style="margin: 0; color: #6b7280;">No alerts in this period</p>
      </td>
    `;
  }

  return severityBadges.map(({ severity, count }) => {
    const colors = SEVERITY_COLORS[severity];
    return `
      <td style="padding: 8px;">
        <div style="text-align: center; padding: 12px 16px; background-color: ${colors.background}; border-radius: 8px; border: 1px solid ${colors.border};">
          <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; color: ${colors.text};">
            ${count}
          </p>
          <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 600; color: ${colors.text};">
            ${getSeverityLabel(severity)}
          </p>
        </div>
      </td>
    `;
  }).join('');
}

/**
 * Generate HTML for recent alerts section
 */
function generateRecentAlertsHtml(alerts: DigestAlertSummary[], options: DigestEmailOptions): string {
  const maxAlerts = options.maxAlerts || 10;
  const limitedAlerts = alerts.slice(0, maxAlerts);

  if (limitedAlerts.length === 0) {
    return `
      <tr>
        <td style="padding: 16px; text-align: center; color: #6b7280;">
          No recent alerts
        </td>
      </tr>
    `;
  }

  return limitedAlerts.map(alert => {
    const colors = SEVERITY_COLORS[alert.severity];
    const typeConfig = ALERT_TYPE_CONFIG[alert.type];
    const time = formatDigestTime(alert.timestamp, options.locale, options.timezone);

    return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width: 60px; vertical-align: top; padding-right: 12px;">
                <span style="display: inline-block; padding: 2px 8px; background-color: ${colors.border}; color: #ffffff; font-size: 10px; font-weight: 600; border-radius: 4px;">
                  ${getSeverityLabel(alert.severity)}
                </span>
              </td>
              <td>
                <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #1f2937;">
                  ${typeConfig?.icon || '📢'} ${escapeHtml(alert.title)}
                </p>
                <p style="margin: 0; font-size: 11px; color: #6b7280;">
                  ${escapeHtml(typeConfig?.label || alert.type)} &bull; ${time}
                  ${alert.walletAddress ? ` &bull; ${truncateAddress(alert.walletAddress)}` : ''}
                  ${alert.marketTitle ? ` &bull; ${escapeHtml(alert.marketTitle.substring(0, 30))}${alert.marketTitle.length > 30 ? '...' : ''}` : ''}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Generate HTML for suspicious wallets section
 */
function generateWalletsHtml(wallets: DigestWalletSummary[], baseUrl?: string): string {
  if (wallets.length === 0) {
    return `
      <tr>
        <td style="padding: 16px; text-align: center; color: #6b7280;">
          No suspicious wallets detected
        </td>
      </tr>
    `;
  }

  return wallets.map((wallet, index) => {
    const scoreColor = wallet.score >= 80 ? '#dc2626' : wallet.score >= 60 ? '#ea580c' : wallet.score >= 40 ? '#ca8a04' : '#16a34a';
    const walletUrl = baseUrl ? `${baseUrl}/wallet/${wallet.address}` : undefined;

    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width: 30px; vertical-align: top;">
                <span style="display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; background-color: #f3f4f6; border-radius: 50%; font-size: 11px; font-weight: 600; color: #6b7280;">
                  ${index + 1}
                </span>
              </td>
              <td>
                <p style="margin: 0 0 4px 0; font-family: monospace; font-size: 12px; color: #1f2937;">
                  ${walletUrl
                    ? `<a href="${escapeHtml(walletUrl)}" style="color: #1f2937; text-decoration: none;">${truncateAddress(wallet.address)}</a>`
                    : truncateAddress(wallet.address)}
                  ${wallet.isFresh ? ' <span style="font-size: 10px; background-color: #dbeafe; color: #1e40af; padding: 1px 6px; border-radius: 4px;">NEW</span>' : ''}
                </p>
                <p style="margin: 0; font-size: 11px; color: #6b7280;">
                  ${wallet.alertCount} alert${wallet.alertCount !== 1 ? 's' : ''}
                  ${wallet.volume ? ` &bull; ${formatCurrency(wallet.volume)} volume` : ''}
                  ${wallet.tradeCount ? ` &bull; ${wallet.tradeCount} trades` : ''}
                </p>
              </td>
              <td style="width: 60px; text-align: right; vertical-align: top;">
                <span style="display: inline-block; padding: 4px 8px; background-color: ${scoreColor}22; color: ${scoreColor}; font-size: 13px; font-weight: 700; border-radius: 4px;">
                  ${wallet.score}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Generate HTML for hot markets section
 */
function generateMarketsHtml(markets: DigestMarketSummary[], baseUrl?: string): string {
  if (markets.length === 0) {
    return `
      <tr>
        <td style="padding: 16px; text-align: center; color: #6b7280;">
          No hot markets today
        </td>
      </tr>
    `;
  }

  return markets.map((market, index) => {
    const marketUrl = baseUrl ? `${baseUrl}/market/${market.id}` : undefined;
    const probChange = market.probabilityChange;
    const changeIndicator = probChange !== undefined
      ? getTrendIndicator(probChange)
      : null;

    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width: 30px; vertical-align: top;">
                <span style="display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; background-color: #fef3c7; border-radius: 50%; font-size: 11px; font-weight: 600; color: #92400e;">
                  ${index + 1}
                </span>
              </td>
              <td>
                <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 500; color: #1f2937;">
                  ${marketUrl
                    ? `<a href="${escapeHtml(marketUrl)}" style="color: #1f2937; text-decoration: none;">${escapeHtml(market.title.substring(0, 50))}${market.title.length > 50 ? '...' : ''}</a>`
                    : `${escapeHtml(market.title.substring(0, 50))}${market.title.length > 50 ? '...' : ''}`}
                </p>
                <p style="margin: 0; font-size: 11px; color: #6b7280;">
                  ${market.alertCount} alert${market.alertCount !== 1 ? 's' : ''}
                  ${market.category ? ` &bull; ${escapeHtml(market.category)}` : ''}
                  ${market.volume ? ` &bull; ${formatCurrency(market.volume)} vol` : ''}
                </p>
              </td>
              ${market.probability !== undefined ? `
              <td style="width: 70px; text-align: right; vertical-align: top;">
                <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
                  ${market.probability.toFixed(0)}%
                </p>
                ${changeIndicator ? `
                <p style="margin: 0; font-size: 11px; color: ${changeIndicator.color};">
                  ${changeIndicator.icon} ${formatPercentage(probChange!)}
                </p>
                ` : ''}
              </td>
              ` : ''}
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Generate HTML for trading statistics section
 */
function generateTradingStatsHtml(data: DailyDigestData): string {
  const stats = data.tradingStats;

  const statItems = [
    { label: 'Total Volume', value: formatCurrency(stats.totalVolume), icon: '💰' },
    { label: 'Whale Trades', value: stats.whaleTradeCount.toString(), icon: '🐋' },
    { label: 'Unique Traders', value: formatCompactNumber(stats.uniqueTraders), icon: '👥' },
    { label: 'Total Trades', value: formatCompactNumber(stats.totalTrades), icon: '📊' },
    { label: 'Avg Trade Size', value: formatCurrency(stats.averageTradeSize), icon: '📏' },
    { label: 'Largest Trade', value: formatCurrency(stats.largestTrade), icon: '🎯' },
  ];

  const rows: string[] = [];
  for (let i = 0; i < statItems.length; i += 2) {
    const left = statItems[i]!;
    const right = statItems[i + 1];

    rows.push(`
      <tr>
        <td style="padding: 8px 12px; width: 50%; border-bottom: 1px solid #e5e7eb;">
          <p style="margin: 0 0 2px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">
            ${left.icon} ${left.label}
          </p>
          <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1f2937;">
            ${left.value}
          </p>
        </td>
        ${right ? `
        <td style="padding: 8px 12px; width: 50%; border-bottom: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb;">
          <p style="margin: 0 0 2px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">
            ${right.icon} ${right.label}
          </p>
          <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1f2937;">
            ${right.value}
          </p>
        </td>
        ` : '<td></td>'}
      </tr>
    `);
  }

  return rows.join('');
}

/**
 * Generate HTML for comparison section
 */
function generateComparisonHtml(data: DailyDigestData): string {
  if (!data.comparison) {
    return '';
  }

  const comp = data.comparison;
  const items = [
    { label: 'Alerts', change: comp.alertChange },
    { label: 'Volume', change: comp.volumeChange },
    { label: 'Whale Activity', change: comp.whaleActivityChange },
  ];

  return `
    <tr>
      <td style="padding: 16px 20px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
          📈 vs Previous Day
        </h3>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            ${items.map(item => {
              const trend = getTrendIndicator(item.change);
              return `
                <td style="padding: 8px; text-align: center;">
                  <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">
                    ${item.label}
                  </p>
                  <p style="margin: 0; font-size: 16px; font-weight: 600; color: ${trend.color};">
                    ${trend.icon} ${formatPercentage(item.change)}
                  </p>
                </td>
              `;
            }).join('')}
          </tr>
        </table>
        ${comp.newSuspiciousWallets > 0 ? `
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">
          🆕 ${comp.newSuspiciousWallets} new suspicious wallet${comp.newSuspiciousWallets !== 1 ? 's' : ''} detected
        </p>
        ` : ''}
      </td>
    </tr>
  `;
}

/**
 * Generate HTML for highlights section
 */
function generateHighlightsHtml(highlights: DigestHighlight[], options: DigestEmailOptions): string {
  if (!highlights || highlights.length === 0) {
    return '';
  }

  const highlightIcons: Record<DigestHighlight['type'], string> = {
    critical_alert: '🚨',
    whale_trade: '🐋',
    insider_signal: '🔍',
    market_resolved: '✅',
    new_pattern: '⚡',
  };

  return `
    <tr>
      <td style="padding: 0 20px 20px 20px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
          ⭐ Key Highlights
        </h3>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border-radius: 8px; border: 1px solid #fcd34d;">
          ${highlights.map(highlight => `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #fcd34d;">
                <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #92400e;">
                  ${highlightIcons[highlight.type]} ${escapeHtml(highlight.title)}
                </p>
                <p style="margin: 0; font-size: 12px; color: #78350f;">
                  ${escapeHtml(highlight.description)}
                </p>
                <p style="margin: 4px 0 0 0; font-size: 10px; color: #92400e;">
                  ${formatDigestTime(highlight.timestamp, options.locale, options.timezone)}
                  ${highlight.url ? ` &bull; <a href="${escapeHtml(highlight.url)}" style="color: #92400e;">View details →</a>` : ''}
                </p>
              </td>
            </tr>
          `).join('')}
        </table>
      </td>
    </tr>
  `;
}

/**
 * Generate the complete HTML digest email
 */
export function generateDigestHtml(
  data: DailyDigestData,
  options: DigestEmailOptions = {}
): string {
  const opts = { ...DEFAULT_DIGEST_OPTIONS, ...options };
  const dateStr = formatDigestDate(data.digestDate, opts.locale, opts.timezone);
  const generatedStr = formatEmailDate(data.generatedAt, opts.locale, opts.timezone);

  // Limit arrays to configured maximums
  const limitedAlerts = data.recentAlerts.slice(0, opts.maxAlerts);
  const limitedWallets = data.topSuspiciousWallets.slice(0, opts.maxWallets);
  const limitedMarkets = data.hotMarkets.slice(0, opts.maxMarkets);

  // Build sections
  const alertCountsHtml = generateAlertCountsHtml(data);
  const recentAlertsHtml = generateRecentAlertsHtml(limitedAlerts, opts);
  const walletsHtml = generateWalletsHtml(limitedWallets, data.baseUrl);
  const marketsHtml = generateMarketsHtml(limitedMarkets, data.baseUrl);
  const tradingStatsHtml = opts.showTradingStats ? generateTradingStatsHtml(data) : '';
  const comparisonHtml = opts.showComparison ? generateComparisonHtml(data) : '';
  const highlightsHtml = opts.showHighlights && data.highlights ? generateHighlightsHtml(data.highlights, opts) : '';

  // Build footer
  let footerHtml = '';
  if (opts.showFooter) {
    footerHtml = `
      <tr>
        <td style="padding: 24px 20px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
            You're receiving this daily digest because you have digest notifications enabled.
          </p>
          ${data.unsubscribeUrl ? `
          <p style="margin: 0; font-size: 12px;">
            <a href="${escapeHtml(data.unsubscribeUrl)}" style="color: #6b7280; text-decoration: underline;">
              Unsubscribe from digests
            </a>
          </p>
          ` : ''}
          ${opts.showBranding ? `
          <p style="margin: 16px 0 0 0; color: #9ca3af; font-size: 11px;">
            Powered by Polymarket Tracker
          </p>
          ` : ''}
        </td>
      </tr>
    `;
  }

  // Custom styles
  const customStyles = opts.customStyles ? `<style>${opts.customStyles}</style>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(generateDigestSubject(data))}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    a { color: inherit; }
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1f2937 !important; }
      .email-container { background-color: #111827 !important; }
      .email-text { color: #f3f4f6 !important; }
    }
  </style>
  ${customStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;" class="email-body">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <!-- Email container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" class="email-container">

          <!-- Header -->
          <tr>
            <td style="padding: 24px 20px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff;">
                📊 Daily Digest
              </h1>
              <p style="margin: 0 0 4px 0; font-size: 16px; color: rgba(255,255,255,0.9);">
                ${dateStr}
              </p>
              ${data.recipientName ? `
              <p style="margin: 8px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.7);">
                Hi ${escapeHtml(data.recipientName)}, here's your daily summary
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Alert Summary -->
          <tr>
            <td style="padding: 20px;">
              <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #374151;">
                🔔 Alert Summary
              </h2>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  ${alertCountsHtml}
                </tr>
              </table>
              <p style="margin: 12px 0 0 0; font-size: 13px; text-align: center; color: #6b7280;">
                Total: <strong>${data.alertCounts.total}</strong> alert${data.alertCounts.total !== 1 ? 's' : ''}
              </p>
            </td>
          </tr>

          ${highlightsHtml}

          ${comparisonHtml}

          <!-- Recent Alerts -->
          ${limitedAlerts.length > 0 ? `
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
                🕐 Recent Alerts
              </h3>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                ${recentAlertsHtml}
              </table>
              ${data.recentAlerts.length > (opts.maxAlerts || 10) ? `
              <p style="margin: 8px 0 0 0; font-size: 12px; text-align: center; color: #6b7280;">
                Showing ${opts.maxAlerts} of ${data.recentAlerts.length} alerts
              </p>
              ` : ''}
            </td>
          </tr>
          ` : ''}

          <!-- Trading Statistics -->
          ${opts.showTradingStats ? `
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
                💹 Trading Activity
              </h3>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                ${tradingStatsHtml}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Top Suspicious Wallets -->
          ${limitedWallets.length > 0 ? `
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
                🔍 Top Suspicious Wallets
              </h3>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                ${walletsHtml}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Hot Markets -->
          ${limitedMarkets.length > 0 ? `
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
                🔥 Hot Markets
              </h3>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                ${marketsHtml}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Dashboard Link -->
          ${data.dashboardUrl ? `
          <tr>
            <td style="padding: 16px 20px 24px 20px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <a href="${escapeHtml(data.dashboardUrl)}"
                       target="_blank"
                       style="display: inline-block; padding: 12px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 6px;">
                      View Full Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Digest ID and Generated Time -->
          <tr>
            <td style="padding: 0 20px 16px 20px;">
              <p style="margin: 0; font-size: 10px; color: #9ca3af; text-align: center;">
                Digest ID: ${escapeHtml(data.digestId)} &bull; Generated: ${generatedStr}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          ${footerHtml}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate plain text version of digest email
 */
export function generateDigestPlainText(
  data: DailyDigestData,
  options: DigestEmailOptions = {}
): string {
  const opts = { ...DEFAULT_DIGEST_OPTIONS, ...options };
  const dateStr = formatDigestDate(data.digestDate, opts.locale, opts.timezone);
  const generatedStr = formatEmailDate(data.generatedAt, opts.locale, opts.timezone);

  const lines: string[] = [];

  // Header
  lines.push('='.repeat(60));
  lines.push('DAILY DIGEST');
  lines.push(dateStr);
  lines.push('='.repeat(60));
  lines.push('');

  if (data.recipientName) {
    lines.push(`Hi ${data.recipientName}, here's your daily summary.`);
    lines.push('');
  }

  // Alert Summary
  lines.push('ALERT SUMMARY');
  lines.push('-'.repeat(40));
  lines.push(`Total Alerts: ${data.alertCounts.total}`);
  if (data.alertCounts.critical > 0) {
    lines.push(`  Critical: ${data.alertCounts.critical}`);
  }
  if (data.alertCounts.high > 0) {
    lines.push(`  High: ${data.alertCounts.high}`);
  }
  if (data.alertCounts.medium > 0) {
    lines.push(`  Medium: ${data.alertCounts.medium}`);
  }
  if (data.alertCounts.low > 0) {
    lines.push(`  Low: ${data.alertCounts.low}`);
  }
  if (data.alertCounts.info > 0) {
    lines.push(`  Info: ${data.alertCounts.info}`);
  }
  lines.push('');

  // Highlights
  if (opts.showHighlights && data.highlights && data.highlights.length > 0) {
    lines.push('KEY HIGHLIGHTS');
    lines.push('-'.repeat(40));
    data.highlights.forEach(h => {
      lines.push(`* ${h.title}`);
      lines.push(`  ${h.description}`);
      if (h.url) {
        lines.push(`  ${h.url}`);
      }
    });
    lines.push('');
  }

  // Comparison
  if (opts.showComparison && data.comparison) {
    lines.push('vs PREVIOUS DAY');
    lines.push('-'.repeat(40));
    lines.push(`Alerts: ${formatPercentage(data.comparison.alertChange)}`);
    lines.push(`Volume: ${formatPercentage(data.comparison.volumeChange)}`);
    lines.push(`Whale Activity: ${formatPercentage(data.comparison.whaleActivityChange)}`);
    if (data.comparison.newSuspiciousWallets > 0) {
      lines.push(`New Suspicious Wallets: ${data.comparison.newSuspiciousWallets}`);
    }
    lines.push('');
  }

  // Recent Alerts
  const limitedAlerts = data.recentAlerts.slice(0, opts.maxAlerts);
  if (limitedAlerts.length > 0) {
    lines.push('RECENT ALERTS');
    lines.push('-'.repeat(40));
    limitedAlerts.forEach(alert => {
      const typeConfig = ALERT_TYPE_CONFIG[alert.type];
      const time = formatDigestTime(alert.timestamp, opts.locale, opts.timezone);
      lines.push(`[${getSeverityLabel(alert.severity)}] ${typeConfig?.label || alert.type}`);
      lines.push(`  ${alert.title}`);
      lines.push(`  Time: ${time}`);
      if (alert.walletAddress) {
        lines.push(`  Wallet: ${alert.walletAddress}`);
      }
      if (alert.marketTitle) {
        lines.push(`  Market: ${alert.marketTitle}`);
      }
      lines.push('');
    });
  }

  // Trading Statistics
  if (opts.showTradingStats) {
    const stats = data.tradingStats;
    lines.push('TRADING ACTIVITY');
    lines.push('-'.repeat(40));
    lines.push(`Total Volume: ${formatCurrency(stats.totalVolume)}`);
    lines.push(`Whale Trades: ${stats.whaleTradeCount}`);
    lines.push(`Unique Traders: ${stats.uniqueTraders}`);
    lines.push(`Total Trades: ${stats.totalTrades}`);
    lines.push(`Average Trade: ${formatCurrency(stats.averageTradeSize)}`);
    lines.push(`Largest Trade: ${formatCurrency(stats.largestTrade)}`);
    lines.push('');
  }

  // Top Suspicious Wallets
  const limitedWallets = data.topSuspiciousWallets.slice(0, opts.maxWallets);
  if (limitedWallets.length > 0) {
    lines.push('TOP SUSPICIOUS WALLETS');
    lines.push('-'.repeat(40));
    limitedWallets.forEach((wallet, i) => {
      lines.push(`${i + 1}. ${wallet.address}`);
      lines.push(`   Score: ${wallet.score}/100 | Alerts: ${wallet.alertCount}`);
      if (wallet.volume) {
        lines.push(`   Volume: ${formatCurrency(wallet.volume)}`);
      }
    });
    lines.push('');
  }

  // Hot Markets
  const limitedMarkets = data.hotMarkets.slice(0, opts.maxMarkets);
  if (limitedMarkets.length > 0) {
    lines.push('HOT MARKETS');
    lines.push('-'.repeat(40));
    limitedMarkets.forEach((market, i) => {
      lines.push(`${i + 1}. ${market.title}`);
      lines.push(`   Alerts: ${market.alertCount}${market.probability !== undefined ? ` | Probability: ${market.probability.toFixed(0)}%` : ''}`);
      if (market.volume) {
        lines.push(`   Volume: ${formatCurrency(market.volume)}`);
      }
    });
    lines.push('');
  }

  // Dashboard Link
  if (data.dashboardUrl) {
    lines.push('VIEW DASHBOARD');
    lines.push('-'.repeat(40));
    lines.push(data.dashboardUrl);
    lines.push('');
  }

  // Digest Info
  lines.push('-'.repeat(40));
  lines.push(`Digest ID: ${data.digestId}`);
  lines.push(`Generated: ${generatedStr}`);
  lines.push('');

  // Footer
  if (opts.showFooter) {
    lines.push('-'.repeat(40));
    lines.push('You\'re receiving this daily digest because you have digest notifications enabled.');
    if (data.unsubscribeUrl) {
      lines.push(`Unsubscribe: ${data.unsubscribeUrl}`);
    }
    if (opts.showBranding) {
      lines.push('');
      lines.push('Powered by Polymarket Tracker');
    }
  }

  return lines.join('\n');
}

/**
 * Render complete digest email with HTML, plain text, and subject
 */
export function renderDigestEmail(
  data: DailyDigestData,
  options: DigestEmailOptions = {}
): RenderedEmail {
  return {
    subject: generateDigestSubject(data),
    html: generateDigestHtml(data, options),
    text: generateDigestPlainText(data, options),
  };
}

/**
 * Create a digest email message ready to send via EmailClient
 */
export function createDigestEmailMessage(
  data: DailyDigestData,
  recipientEmail: string,
  options: DigestEmailOptions = {}
): { to: string; subject: string; html: string; text: string } {
  const rendered = renderDigestEmail(data, options);

  return {
    to: recipientEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  };
}

/**
 * Validate daily digest data
 */
export function validateDigestData(data: unknown): data is DailyDigestData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const d = data as Record<string, unknown>;

  // Required fields
  if (typeof d.digestId !== 'string' || !d.digestId) {
    return false;
  }
  if (!(d.digestDate instanceof Date)) {
    return false;
  }
  if (!(d.generatedAt instanceof Date)) {
    return false;
  }
  if (!d.alertCounts || typeof d.alertCounts !== 'object') {
    return false;
  }
  if (!Array.isArray(d.recentAlerts)) {
    return false;
  }
  if (!Array.isArray(d.topSuspiciousWallets)) {
    return false;
  }
  if (!Array.isArray(d.hotMarkets)) {
    return false;
  }
  if (!d.tradingStats || typeof d.tradingStats !== 'object') {
    return false;
  }

  return true;
}

/**
 * Create sample/mock digest data for testing or preview
 */
export function createSampleDigestData(overrides?: Partial<DailyDigestData>): DailyDigestData {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return {
    digestId: `digest-${now.getTime()}`,
    recipientName: 'Trader',
    digestDate: yesterday,
    generatedAt: now,
    alertCounts: {
      total: 47,
      critical: 2,
      high: 8,
      medium: 15,
      low: 12,
      info: 10,
    },
    alertsByType: {
      whale_trade: 12,
      price_movement: 8,
      insider_activity: 3,
      fresh_wallet: 7,
      coordinated_activity: 5,
      unusual_pattern: 6,
      market_resolved: 2,
      new_market: 4,
    },
    recentAlerts: [
      {
        id: 'alert-1',
        type: 'whale_trade',
        severity: 'critical',
        title: '$500K position opened on Election outcome',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        marketTitle: 'Will the election happen in 2024?',
      },
      {
        id: 'alert-2',
        type: 'insider_activity',
        severity: 'high',
        title: 'Unusual pattern detected in regulatory market',
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        marketTitle: 'Will the SEC approve ETF by Q1?',
      },
      {
        id: 'alert-3',
        type: 'fresh_wallet',
        severity: 'medium',
        title: 'Fresh wallet made large first trade',
        timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        walletAddress: '0x9876543210fedcba9876543210fedcba98765432',
      },
    ],
    topSuspiciousWallets: [
      {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        score: 87,
        alertCount: 12,
        volume: 750000,
        tradeCount: 45,
        isFresh: false,
        labels: ['Whale', 'High Win Rate'],
      },
      {
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
        score: 73,
        alertCount: 8,
        volume: 250000,
        tradeCount: 23,
        isFresh: true,
        labels: ['Fresh', 'Category Focus'],
      },
      {
        address: '0x9876543210fedcba9876543210fedcba98765432',
        score: 65,
        alertCount: 5,
        volume: 180000,
        tradeCount: 15,
      },
    ],
    hotMarkets: [
      {
        id: 'market-1',
        title: 'Will the election happen in 2024?',
        alertCount: 15,
        probability: 67,
        probabilityChange: 5.2,
        volume: 2500000,
        category: 'Politics',
      },
      {
        id: 'market-2',
        title: 'Will the SEC approve ETF by Q1?',
        alertCount: 8,
        probability: 45,
        probabilityChange: -3.1,
        volume: 1200000,
        category: 'Crypto',
      },
      {
        id: 'market-3',
        title: 'Will Bitcoin reach $100K in 2024?',
        alertCount: 6,
        probability: 32,
        probabilityChange: 8.5,
        volume: 800000,
        category: 'Crypto',
      },
    ],
    tradingStats: {
      totalVolume: 15000000,
      whaleTradeCount: 45,
      uniqueTraders: 1250,
      averageTradeSize: 12000,
      largestTrade: 500000,
      totalTrades: 8500,
    },
    comparison: {
      alertChange: 15,
      volumeChange: -8,
      whaleActivityChange: 25,
      newSuspiciousWallets: 3,
    },
    highlights: [
      {
        type: 'whale_trade',
        title: 'Record $500K trade on Election market',
        description: 'Largest single trade this week from a previously inactive whale wallet',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        type: 'insider_signal',
        title: 'Potential insider activity detected',
        description: 'Cluster of coordinated trades 2 hours before major news announcement',
        timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      },
    ],
    dashboardUrl: 'https://polymarket-tracker.example.com/dashboard',
    baseUrl: 'https://polymarket-tracker.example.com',
    unsubscribeUrl: 'https://polymarket-tracker.example.com/unsubscribe',
    timezone: 'UTC',
    ...overrides,
  };
}

/**
 * Preview digest email in browser (useful for development)
 */
export function getDigestEmailPreviewHtml(
  data: DailyDigestData,
  options: DigestEmailOptions = {}
): string {
  const html = generateDigestHtml(data, options);
  const text = generateDigestPlainText(data, options);
  const subject = generateDigestSubject(data);

  return `<!DOCTYPE html>
<html>
<head>
  <title>Email Preview: ${escapeHtml(subject)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
    .preview-container { max-width: 1200px; margin: 0 auto; }
    .preview-header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .preview-tabs { display: flex; background: #374151; }
    .preview-tab { padding: 12px 24px; color: white; cursor: pointer; border: none; background: transparent; }
    .preview-tab.active { background: #4b5563; }
    .preview-content { background: white; padding: 0; min-height: 600px; }
    .preview-html iframe { width: 100%; height: 1200px; border: none; }
    .preview-text { padding: 20px; white-space: pre-wrap; font-family: monospace; background: #1f2937; color: #f3f4f6; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="preview-container">
    <div class="preview-header">
      <h1 style="margin: 0 0 8px 0;">Digest Email Preview</h1>
      <p style="margin: 0; opacity: 0.8;">Subject: ${escapeHtml(subject)}</p>
    </div>
    <div class="preview-tabs">
      <button class="preview-tab active" onclick="showTab('html')">HTML Version</button>
      <button class="preview-tab" onclick="showTab('text')">Plain Text</button>
    </div>
    <div class="preview-content">
      <div id="html-preview" class="preview-html">
        <iframe srcdoc="${escapeHtml(html).replace(/"/g, '&quot;')}"></iframe>
      </div>
      <div id="text-preview" class="preview-text hidden">
${escapeHtml(text)}
      </div>
    </div>
  </div>
  <script>
    function showTab(tab) {
      document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.preview-html, .preview-text').forEach(c => c.classList.add('hidden'));
      event.target.classList.add('active');
      document.getElementById(tab + '-preview').classList.remove('hidden');
    }
  </script>
</body>
</html>`;
}
