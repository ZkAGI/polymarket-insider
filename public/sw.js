/**
 * Service Worker for Web Push Notifications
 * Polymarket Insider/Whale Tracker
 *
 * Handles:
 * - Push events (receiving push notifications)
 * - Showing notifications with customization
 * - Handling notification clicks
 */

// Service Worker Version - increment when updating
const SW_VERSION = "1.0.0";

// Default notification options
const DEFAULT_NOTIFICATION = {
  icon: "/icon-192.png",
  badge: "/badge-72.png",
  vibrate: [100, 50, 100],
  requireInteraction: false,
  silent: false,
};

// Default URLs
const DEFAULT_URL = "/";
const ALERTS_URL = "/alerts";
const MARKET_URL_PREFIX = "/market/";
const WALLET_URL_PREFIX = "/wallet/";

/**
 * Install event - called when service worker is first installed
 */
self.addEventListener("install", (event) => {
  console.log(`[SW v${SW_VERSION}] Installing service worker...`);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

/**
 * Activate event - called when service worker becomes active
 */
self.addEventListener("activate", (event) => {
  console.log(`[SW v${SW_VERSION}] Service worker activated`);
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

/**
 * Push event - called when a push notification is received
 */
self.addEventListener("push", (event) => {
  console.log(`[SW v${SW_VERSION}] Push received`);

  // Default notification if no payload
  let payload = {
    title: "Polymarket Tracker",
    body: "You have a new notification",
    url: ALERTS_URL,
  };

  // Parse payload if present
  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch (error) {
      console.error(`[SW v${SW_VERSION}] Error parsing push payload:`, error);
      // Try as text
      try {
        payload.body = event.data.text();
      } catch {
        // Keep default
      }
    }
  }

  // Build notification options
  const notificationOptions = buildNotificationOptions(payload);

  // Show the notification
  event.waitUntil(self.registration.showNotification(payload.title, notificationOptions));
});

/**
 * Notification click event - called when user clicks on a notification
 */
self.addEventListener("notificationclick", (event) => {
  console.log(`[SW v${SW_VERSION}] Notification clicked`);

  // Close the notification
  event.notification.close();

  // Get the action and data
  const action = event.action;
  const data = event.notification.data || {};

  // Determine URL to open
  let targetUrl = data.url || DEFAULT_URL;

  // Handle action buttons
  if (action) {
    targetUrl = handleNotificationAction(action, data) || targetUrl;
  }

  // Open or focus the target URL
  event.waitUntil(openOrFocusWindow(targetUrl));
});

/**
 * Notification close event - called when notification is dismissed
 */
self.addEventListener("notificationclose", (event) => {
  console.log(`[SW v${SW_VERSION}] Notification closed`);

  // Track notification dismissal if needed
  const data = event.notification.data || {};
  if (data.trackDismissal) {
    // Could send analytics event here
    console.log(`[SW v${SW_VERSION}] Notification dismissed:`, data.tag || "unknown");
  }
});

/**
 * Message event - handle messages from main app
 */
self.addEventListener("message", (event) => {
  console.log(`[SW v${SW_VERSION}] Message received:`, event.data);

  if (event.data && event.data.type) {
    switch (event.data.type) {
      case "GET_VERSION":
        event.ports[0]?.postMessage({ version: SW_VERSION });
        break;

      case "SKIP_WAITING":
        self.skipWaiting();
        break;

      case "SHOW_NOTIFICATION":
        // Allow main app to request showing a notification
        if (event.data.payload) {
          const options = buildNotificationOptions(event.data.payload);
          self.registration.showNotification(event.data.payload.title, options);
        }
        break;

      default:
        console.log(`[SW v${SW_VERSION}] Unknown message type:`, event.data.type);
    }
  }
});

/**
 * Build notification options from payload
 * @param {Object} payload - Notification payload
 * @returns {NotificationOptions} - Options for showNotification
 */
function buildNotificationOptions(payload) {
  const options = {
    body: payload.body || "",
    icon: payload.icon || DEFAULT_NOTIFICATION.icon,
    badge: payload.badge || DEFAULT_NOTIFICATION.badge,
    tag: payload.tag || generateTag(payload),
    requireInteraction: payload.requireInteraction ?? DEFAULT_NOTIFICATION.requireInteraction,
    silent: payload.silent ?? DEFAULT_NOTIFICATION.silent,
    data: {
      url: payload.url || DEFAULT_URL,
      ...payload.data,
    },
  };

  // Add optional fields if present
  if (payload.image) {
    options.image = payload.image;
  }

  if (payload.vibrate !== undefined) {
    options.vibrate = payload.vibrate;
  } else if (!payload.silent) {
    options.vibrate = DEFAULT_NOTIFICATION.vibrate;
  }

  if (payload.timestamp) {
    options.timestamp = payload.timestamp;
  }

  if (payload.dir) {
    options.dir = payload.dir;
  }

  if (payload.lang) {
    options.lang = payload.lang;
  }

  if (payload.renotify !== undefined) {
    options.renotify = payload.renotify;
  }

  // Add action buttons if present
  if (payload.actions && Array.isArray(payload.actions)) {
    options.actions = payload.actions.map((action) => ({
      action: action.action,
      title: action.title,
      icon: action.icon,
    }));
  }

  return options;
}

/**
 * Generate a tag for the notification
 * Used for grouping/replacing notifications
 * @param {Object} payload - Notification payload
 * @returns {string} - Tag string
 */
function generateTag(payload) {
  // Use provided tag or generate from data
  if (payload.data?.alertId) {
    return `alert-${payload.data.alertId}`;
  }
  if (payload.data?.marketId) {
    return `market-${payload.data.marketId}`;
  }
  if (payload.data?.walletAddress) {
    return `wallet-${payload.data.walletAddress}`;
  }
  // Fallback to timestamp-based tag
  return `notification-${Date.now()}`;
}

/**
 * Handle notification action clicks
 * @param {string} action - The action identifier
 * @param {Object} data - Notification data
 * @returns {string|null} - URL to open or null
 */
function handleNotificationAction(action, data) {
  switch (action) {
    case "view_alert":
    case "view_alerts":
      return ALERTS_URL;

    case "view_market":
      if (data.marketId) {
        return `${MARKET_URL_PREFIX}${data.marketId}`;
      }
      if (data.marketSlug) {
        return `${MARKET_URL_PREFIX}${data.marketSlug}`;
      }
      return ALERTS_URL;

    case "view_wallet":
      if (data.walletAddress) {
        return `${WALLET_URL_PREFIX}${data.walletAddress}`;
      }
      return ALERTS_URL;

    case "dismiss":
      // Don't open any URL
      return null;

    case "settings":
      return "/settings";

    default:
      // Check if action has a URL in data
      if (data[`${action}_url`]) {
        return data[`${action}_url`];
      }
      return null;
  }
}

/**
 * Open or focus a window/tab with the given URL
 * @param {string} url - URL to open
 * @returns {Promise} - Promise that resolves when complete
 */
async function openOrFocusWindow(url) {
  // Get the full URL
  const fullUrl = new URL(url, self.location.origin).href;

  // Get all window clients
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  // Try to find an existing window with this URL or same origin
  for (const client of windowClients) {
    // Check if it's the same URL
    if (client.url === fullUrl) {
      // Focus this window
      if ("focus" in client) {
        return client.focus();
      }
      return;
    }

    // Check if same origin and can navigate
    const clientUrl = new URL(client.url);
    const targetUrl = new URL(fullUrl);

    if (clientUrl.origin === targetUrl.origin) {
      // Navigate existing window
      if ("navigate" in client) {
        await client.navigate(fullUrl);
        return client.focus();
      }
      // Focus and let the app handle navigation
      if ("focus" in client) {
        client.postMessage({
          type: "NAVIGATE",
          url: fullUrl,
        });
        return client.focus();
      }
    }
  }

  // No suitable window found, open a new one
  if (self.clients.openWindow) {
    return self.clients.openWindow(fullUrl);
  }
}

/**
 * Log helper for debugging
 * @param  {...any} args - Arguments to log
 */
function log(...args) {
  console.log(`[SW v${SW_VERSION}]`, ...args);
}

// Log that service worker is loaded
log("Service worker loaded");
