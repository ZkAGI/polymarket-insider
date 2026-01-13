/**
 * Alert email template
 * Generates HTML and plain text emails for alert notifications
 * Uses email-safe HTML/CSS that works across major email clients
 */

import {
  AlertTemplateData,
  AlertEmailOptions,
  RenderedEmail,
  SeverityColors,
  AlertTypeConfig,
  AlertSeverity,
  AlertType,
} from './types';

/**
 * Default options for alert email rendering
 */
const DEFAULT_OPTIONS: AlertEmailOptions = {
  includePlainText: true,
  showFooter: true,
  showBranding: true,
  locale: 'en-US',
  timezone: 'UTC',
};

/**
 * Color schemes for different severity levels
 * Uses email-safe hex colors
 */
export const SEVERITY_COLORS: Record<AlertSeverity, SeverityColors> = {
  critical: {
    background: '#fef2f2',
    text: '#991b1b',
    border: '#dc2626',
    icon: '#dc2626',
  },
  high: {
    background: '#fff7ed',
    text: '#9a3412',
    border: '#ea580c',
    icon: '#ea580c',
  },
  medium: {
    background: '#fefce8',
    text: '#854d0e',
    border: '#ca8a04',
    icon: '#ca8a04',
  },
  low: {
    background: '#f0fdf4',
    text: '#166534',
    border: '#16a34a',
    icon: '#16a34a',
  },
  info: {
    background: '#eff6ff',
    text: '#1e40af',
    border: '#3b82f6',
    icon: '#3b82f6',
  },
};

/**
 * Alert type configurations with labels and icons (emoji)
 */
export const ALERT_TYPE_CONFIG: Record<AlertType, AlertTypeConfig> = {
  whale_trade: {
    label: 'Whale Trade',
    icon: '🐋',
    description: 'Large trade detected',
  },
  price_movement: {
    label: 'Price Movement',
    icon: '📈',
    description: 'Significant price change',
  },
  insider_activity: {
    label: 'Insider Activity',
    icon: '🔍',
    description: 'Potential insider trading detected',
  },
  fresh_wallet: {
    label: 'Fresh Wallet',
    icon: '🆕',
    description: 'New wallet activity detected',
  },
  wallet_reactivation: {
    label: 'Wallet Reactivation',
    icon: '⏰',
    description: 'Dormant wallet became active',
  },
  coordinated_activity: {
    label: 'Coordinated Activity',
    icon: '🔗',
    description: 'Coordinated trading detected',
  },
  unusual_pattern: {
    label: 'Unusual Pattern',
    icon: '⚠️',
    description: 'Unusual trading pattern detected',
  },
  market_resolved: {
    label: 'Market Resolved',
    icon: '✅',
    description: 'Market has been resolved',
  },
  new_market: {
    label: 'New Market',
    icon: '🆕',
    description: 'New market created',
  },
  suspicious_funding: {
    label: 'Suspicious Funding',
    icon: '💰',
    description: 'Suspicious funding pattern detected',
  },
  sanctioned_activity: {
    label: 'Sanctioned Activity',
    icon: '🚫',
    description: 'Activity from sanctioned entity',
  },
  system: {
    label: 'System',
    icon: '⚙️',
    description: 'System notification',
  },
};

/**
 * Format a date for display in emails
 */
export function formatEmailDate(
  date: Date,
  locale: string = 'en-US',
  timezone: string = 'UTC'
): string {
  try {
    return date.toLocaleString(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    // Fallback to ISO format if timezone is invalid
    return date.toISOString();
  }
}

/**
 * Format a currency value for display
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a percentage value for display
 */
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Truncate a wallet address for display
 */
export function truncateAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2 + 3) {
    return address;
  }
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
}

/**
 * Get severity label for display
 */
export function getSeverityLabel(severity: AlertSeverity): string {
  const labels: Record<AlertSeverity, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    info: 'INFO',
  };
  return labels[severity];
}

/**
 * Generate the email subject line
 */
export function generateSubject(data: AlertTemplateData): string {
  const severityPrefix = data.severity === 'critical' ? '🚨 ' : '';
  const typeConfig = ALERT_TYPE_CONFIG[data.alertType];
  const typeLabel = typeConfig?.label || data.alertType;

  return `${severityPrefix}[${getSeverityLabel(data.severity)}] ${typeLabel}: ${data.title}`;
}

/**
 * Generate the HTML email template
 */
export function generateAlertHtml(
  data: AlertTemplateData,
  options: AlertEmailOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const colors = SEVERITY_COLORS[data.severity];
  const typeConfig = ALERT_TYPE_CONFIG[data.alertType];
  const formattedDate = formatEmailDate(data.timestamp, opts.locale, opts.timezone);

  // Build metadata rows
  let metadataHtml = '';

  if (data.walletAddress) {
    metadataHtml += `
      <tr>
        <td style="padding: 8px 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Wallet</td>
        <td style="padding: 8px 12px; color: #1f2937; font-family: monospace; border-bottom: 1px solid #e5e7eb;">
          ${escapeHtml(data.walletAddress)}
        </td>
      </tr>
    `;
  }

  if (data.marketTitle) {
    metadataHtml += `
      <tr>
        <td style="padding: 8px 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Market</td>
        <td style="padding: 8px 12px; color: #1f2937; border-bottom: 1px solid #e5e7eb;">
          ${escapeHtml(data.marketTitle)}
        </td>
      </tr>
    `;
  }

  if (data.tradeSize !== undefined) {
    metadataHtml += `
      <tr>
        <td style="padding: 8px 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Trade Size</td>
        <td style="padding: 8px 12px; color: #1f2937; border-bottom: 1px solid #e5e7eb;">
          ${formatCurrency(data.tradeSize)}
        </td>
      </tr>
    `;
  }

  if (data.priceChange !== undefined) {
    const changeColor = data.priceChange >= 0 ? '#16a34a' : '#dc2626';
    metadataHtml += `
      <tr>
        <td style="padding: 8px 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Price Change</td>
        <td style="padding: 8px 12px; color: ${changeColor}; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
          ${formatPercentage(data.priceChange)}
        </td>
      </tr>
    `;
  }

  if (data.suspicionScore !== undefined) {
    const scoreColor = data.suspicionScore >= 80 ? '#dc2626' : data.suspicionScore >= 60 ? '#ea580c' : data.suspicionScore >= 40 ? '#ca8a04' : '#16a34a';
    metadataHtml += `
      <tr>
        <td style="padding: 8px 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Suspicion Score</td>
        <td style="padding: 8px 12px; color: ${scoreColor}; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
          ${data.suspicionScore}/100
        </td>
      </tr>
    `;
  }

  // Add custom metadata
  if (data.metadata) {
    for (const [key, value] of Object.entries(data.metadata)) {
      metadataHtml += `
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">${escapeHtml(key)}</td>
          <td style="padding: 8px 12px; color: #1f2937; border-bottom: 1px solid #e5e7eb;">
            ${escapeHtml(String(value))}
          </td>
        </tr>
      `;
    }
  }

  // Build action button if URL provided
  let actionButtonHtml = '';
  if (data.actionUrl) {
    actionButtonHtml = `
      <tr>
        <td style="padding: 24px 0;">
          <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
            <tr>
              <td style="border-radius: 6px; background-color: ${colors.border};">
                <a href="${escapeHtml(data.actionUrl)}"
                   target="_blank"
                   style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
                  View Alert Details
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  // Build dashboard link
  let dashboardLinkHtml = '';
  if (data.dashboardUrl) {
    dashboardLinkHtml = `
      <tr>
        <td style="padding: 8px 0; text-align: center;">
          <a href="${escapeHtml(data.dashboardUrl)}"
             target="_blank"
             style="color: #6b7280; text-decoration: underline; font-size: 13px;">
            View Dashboard
          </a>
        </td>
      </tr>
    `;
  }

  // Build footer
  let footerHtml = '';
  if (opts.showFooter) {
    footerHtml = `
      <tr>
        <td style="padding: 24px 20px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
            You're receiving this email because you have alerts enabled for Polymarket Tracker.
          </p>
          ${data.unsubscribeUrl ? `
          <p style="margin: 0; font-size: 12px;">
            <a href="${escapeHtml(data.unsubscribeUrl)}" style="color: #6b7280; text-decoration: underline;">
              Unsubscribe from alerts
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

  // Add custom styles
  const customStyles = opts.customStyles ? `<style>${opts.customStyles}</style>` : '';

  // Build the complete HTML email
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(generateSubject(data))}</title>
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
    /* Email client reset */
    body { margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    a { color: inherit; }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1f2937 !important; }
      .email-container { background-color: #111827 !important; }
      .email-text { color: #f3f4f6 !important; }
      .email-text-muted { color: #9ca3af !important; }
    }
  </style>
  ${customStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;" class="email-body">
  <!-- Email wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <!-- Email container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" class="email-container">

          <!-- Header with severity indicator -->
          <tr>
            <td style="padding: 24px 20px; background-color: ${colors.background}; border-bottom: 3px solid ${colors.border}; border-radius: 8px 8px 0 0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <!-- Severity badge -->
                    <span style="display: inline-block; padding: 4px 12px; background-color: ${colors.border}; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 4px; letter-spacing: 0.5px;">
                      ${getSeverityLabel(data.severity)}
                    </span>
                    <!-- Alert type badge -->
                    <span style="display: inline-block; padding: 4px 12px; background-color: #e5e7eb; color: #374151; font-size: 11px; font-weight: 600; border-radius: 4px; margin-left: 8px;">
                      ${typeConfig?.icon || '📢'} ${escapeHtml(typeConfig?.label || data.alertType)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 16px;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: ${colors.text}; line-height: 1.4;">
                      ${escapeHtml(data.title)}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 8px;">
                    <span style="font-size: 13px; color: #6b7280;">
                      ${formattedDate}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message body -->
          <tr>
            <td style="padding: 24px 20px;">
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #374151;" class="email-text">
                ${escapeHtml(data.message)}
              </p>
            </td>
          </tr>

          ${metadataHtml ? `
          <!-- Alert details table -->
          <tr>
            <td style="padding: 0 20px 24px 20px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                ${metadataHtml}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Action button -->
          ${actionButtonHtml}

          <!-- Dashboard link -->
          ${dashboardLinkHtml}

          <!-- Greeting for recipient -->
          ${data.recipientName ? `
          <tr>
            <td style="padding: 0 20px 16px 20px;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                Hi ${escapeHtml(data.recipientName)}, this alert was sent to keep you informed about important market activity.
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Alert ID reference -->
          <tr>
            <td style="padding: 0 20px 24px 20px;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af; font-family: monospace;">
                Alert ID: ${escapeHtml(data.alertId)}
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
 * Generate the plain text email version
 */
export function generateAlertPlainText(
  data: AlertTemplateData,
  options: AlertEmailOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const typeConfig = ALERT_TYPE_CONFIG[data.alertType];
  const formattedDate = formatEmailDate(data.timestamp, opts.locale, opts.timezone);

  const lines: string[] = [];

  // Header
  lines.push('='.repeat(60));
  lines.push(`[${getSeverityLabel(data.severity)}] ${typeConfig?.label || data.alertType}`);
  lines.push('='.repeat(60));
  lines.push('');

  // Title and date
  lines.push(data.title);
  lines.push(`Date: ${formattedDate}`);
  lines.push('');

  // Message
  lines.push(data.message);
  lines.push('');

  // Details
  lines.push('-'.repeat(40));
  lines.push('ALERT DETAILS');
  lines.push('-'.repeat(40));

  if (data.walletAddress) {
    lines.push(`Wallet: ${data.walletAddress}`);
  }
  if (data.marketTitle) {
    lines.push(`Market: ${data.marketTitle}`);
  }
  if (data.tradeSize !== undefined) {
    lines.push(`Trade Size: ${formatCurrency(data.tradeSize)}`);
  }
  if (data.priceChange !== undefined) {
    lines.push(`Price Change: ${formatPercentage(data.priceChange)}`);
  }
  if (data.suspicionScore !== undefined) {
    lines.push(`Suspicion Score: ${data.suspicionScore}/100`);
  }

  // Custom metadata
  if (data.metadata) {
    for (const [key, value] of Object.entries(data.metadata)) {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('');

  // Links
  if (data.actionUrl) {
    lines.push(`View Alert: ${data.actionUrl}`);
  }
  if (data.dashboardUrl) {
    lines.push(`Dashboard: ${data.dashboardUrl}`);
  }

  lines.push('');

  // Greeting
  if (data.recipientName) {
    lines.push(`Hi ${data.recipientName}, this alert was sent to keep you informed about important market activity.`);
    lines.push('');
  }

  // Alert ID
  lines.push(`Alert ID: ${data.alertId}`);
  lines.push('');

  // Footer
  if (opts.showFooter) {
    lines.push('-'.repeat(40));
    lines.push('You\'re receiving this email because you have alerts enabled for Polymarket Tracker.');
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
 * Render a complete alert email with HTML, plain text, and subject
 */
export function renderAlertEmail(
  data: AlertTemplateData,
  options: AlertEmailOptions = {}
): RenderedEmail {
  return {
    subject: generateSubject(data),
    html: generateAlertHtml(data, options),
    text: generateAlertPlainText(data, options),
  };
}

/**
 * Create an email message object ready to send via EmailClient
 */
export function createAlertEmailMessage(
  data: AlertTemplateData,
  recipientEmail: string,
  options: AlertEmailOptions = {}
): { to: string; subject: string; html: string; text: string } {
  const rendered = renderAlertEmail(data, options);

  return {
    to: recipientEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  };
}

/**
 * Validate alert template data
 */
export function validateAlertTemplateData(data: unknown): data is AlertTemplateData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const d = data as Record<string, unknown>;

  // Required fields
  if (typeof d.alertId !== 'string' || !d.alertId) {
    return false;
  }
  if (typeof d.alertType !== 'string' || !ALERT_TYPE_CONFIG[d.alertType as AlertType]) {
    return false;
  }
  if (typeof d.severity !== 'string' || !SEVERITY_COLORS[d.severity as AlertSeverity]) {
    return false;
  }
  if (typeof d.title !== 'string' || !d.title) {
    return false;
  }
  if (typeof d.message !== 'string' || !d.message) {
    return false;
  }
  if (!(d.timestamp instanceof Date)) {
    return false;
  }

  return true;
}

/**
 * Get severity colors for external use
 */
export function getSeverityColors(severity: AlertSeverity): SeverityColors {
  return SEVERITY_COLORS[severity];
}

/**
 * Get alert type config for external use
 */
export function getAlertTypeConfig(alertType: AlertType): AlertTypeConfig {
  return ALERT_TYPE_CONFIG[alertType];
}

/**
 * Preview alert email in browser (useful for development)
 */
export function getAlertEmailPreviewHtml(
  data: AlertTemplateData,
  options: AlertEmailOptions = {}
): string {
  const html = generateAlertHtml(data, options);
  const text = generateAlertPlainText(data, options);

  return `<!DOCTYPE html>
<html>
<head>
  <title>Email Preview: ${escapeHtml(generateSubject(data))}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
    .preview-container { max-width: 1200px; margin: 0 auto; }
    .preview-header { background: #1f2937; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .preview-tabs { display: flex; background: #374151; }
    .preview-tab { padding: 12px 24px; color: white; cursor: pointer; border: none; background: transparent; }
    .preview-tab.active { background: #4b5563; }
    .preview-content { background: white; padding: 0; min-height: 600px; }
    .preview-html iframe { width: 100%; height: 800px; border: none; }
    .preview-text { padding: 20px; white-space: pre-wrap; font-family: monospace; background: #1f2937; color: #f3f4f6; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="preview-container">
    <div class="preview-header">
      <h1 style="margin: 0 0 8px 0;">Email Preview</h1>
      <p style="margin: 0; opacity: 0.8;">Subject: ${escapeHtml(generateSubject(data))}</p>
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
