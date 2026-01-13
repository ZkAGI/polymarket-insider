/**
 * Service Worker types and utilities for Web Push notifications
 *
 * This module provides:
 * - TypeScript types for service worker communication
 * - Registration and management utilities
 * - Helper functions for interacting with the service worker
 */

import type { PushNotificationPayload, PushSubscription as PushSubType } from "./types";

// ============================================================================
// Service Worker Message Types
// ============================================================================

/**
 * Message types that can be sent to the service worker
 */
export type ServiceWorkerMessageType = "GET_VERSION" | "SKIP_WAITING" | "SHOW_NOTIFICATION";

/**
 * Base message interface for service worker communication
 */
export interface ServiceWorkerMessageBase {
  type: ServiceWorkerMessageType;
}

/**
 * Get version message
 */
export interface GetVersionMessage extends ServiceWorkerMessageBase {
  type: "GET_VERSION";
}

/**
 * Skip waiting message
 */
export interface SkipWaitingMessage extends ServiceWorkerMessageBase {
  type: "SKIP_WAITING";
}

/**
 * Show notification message
 */
export interface ShowNotificationMessage extends ServiceWorkerMessageBase {
  type: "SHOW_NOTIFICATION";
  payload: PushNotificationPayload;
}

/**
 * Union type for all service worker messages
 */
export type ServiceWorkerMessage = GetVersionMessage | SkipWaitingMessage | ShowNotificationMessage;

/**
 * Response from GET_VERSION message
 */
export interface VersionResponse {
  version: string;
}

/**
 * Message sent from service worker to client for navigation
 */
export interface NavigateMessage {
  type: "NAVIGATE";
  url: string;
}

// ============================================================================
// Service Worker State Types
// ============================================================================

/**
 * Service worker registration state
 */
export enum ServiceWorkerState {
  /** Not supported in this browser */
  NOT_SUPPORTED = "not_supported",
  /** Not registered yet */
  NOT_REGISTERED = "not_registered",
  /** Registration in progress */
  REGISTERING = "registering",
  /** Registered and ready */
  REGISTERED = "registered",
  /** Active and controlling the page */
  ACTIVE = "active",
  /** Update available */
  UPDATE_AVAILABLE = "update_available",
  /** Error during registration */
  ERROR = "error",
}

/**
 * Service worker registration result
 */
export interface ServiceWorkerRegistrationResult {
  success: boolean;
  state: ServiceWorkerState;
  registration?: ServiceWorkerRegistration;
  error?: string;
}

/**
 * Service worker update check result
 */
export interface ServiceWorkerUpdateResult {
  updateAvailable: boolean;
  version?: string;
}

// ============================================================================
// Registration and Management Utilities
// ============================================================================

/**
 * Check if service workers are supported in the current browser
 */
export function isServiceWorkerSupported(): boolean {
  return "serviceWorker" in navigator;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return "PushManager" in window && isServiceWorkerSupported();
}

/**
 * Check if the Notification API is supported
 */
export function isNotificationSupported(): boolean {
  return "Notification" in window;
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Request notification permission
 * @returns Promise that resolves with the permission status
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    // Some browsers return void from requestPermission
    return Notification.permission;
  }
}

/**
 * Register the service worker
 * @param swPath - Path to the service worker file (default: "/sw.js")
 * @param scope - Scope for the service worker (default: "/")
 * @returns Registration result
 */
export async function registerServiceWorker(
  swPath: string = "/sw.js",
  scope: string = "/"
): Promise<ServiceWorkerRegistrationResult> {
  if (!isServiceWorkerSupported()) {
    return {
      success: false,
      state: ServiceWorkerState.NOT_SUPPORTED,
      error: "Service workers are not supported in this browser",
    };
  }

  try {
    const registration = await navigator.serviceWorker.register(swPath, { scope });

    // Determine the current state
    let state: ServiceWorkerState;
    if (registration.active) {
      state = ServiceWorkerState.ACTIVE;
    } else if (registration.installing || registration.waiting) {
      state = ServiceWorkerState.REGISTERING;
    } else {
      state = ServiceWorkerState.REGISTERED;
    }

    // Listen for updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version available
            console.log("[SW] New service worker installed, update available");
          }
        });
      }
    });

    return {
      success: true,
      state,
      registration,
    };
  } catch (error) {
    return {
      success: false,
      state: ServiceWorkerState.ERROR,
      error: error instanceof Error ? error.message : "Unknown registration error",
    };
  }
}

/**
 * Get the current service worker registration
 * @returns The registration or null if not registered
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration || null;
  } catch {
    return null;
  }
}

/**
 * Unregister the service worker
 * @returns True if unregistered successfully
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return await registration.unregister();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Send a message to the service worker
 * @param message - Message to send
 * @returns Promise that resolves with the response
 */
export async function sendMessageToServiceWorker<T = unknown>(
  message: ServiceWorkerMessage
): Promise<T | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) {
    return null;
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      resolve(event.data as T);
    };

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      resolve(null);
    }, 5000);

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(event.data as T);
    };

    registration.active!.postMessage(message, [messageChannel.port2]);
  });
}

/**
 * Get the service worker version
 * @returns The version string or null
 */
export async function getServiceWorkerVersion(): Promise<string | null> {
  const response = await sendMessageToServiceWorker<VersionResponse>({
    type: "GET_VERSION",
  });
  return response?.version || null;
}

/**
 * Check for service worker updates
 * @returns Update result
 */
export async function checkForUpdates(): Promise<ServiceWorkerUpdateResult> {
  if (!isServiceWorkerSupported()) {
    return { updateAvailable: false };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();

      // Check if there's a waiting worker (indicates update available)
      if (registration.waiting) {
        return {
          updateAvailable: true,
        };
      }
    }
    return { updateAvailable: false };
  } catch {
    return { updateAvailable: false };
  }
}

/**
 * Apply a pending service worker update
 * Tells the waiting service worker to skip waiting and become active
 */
export async function applyUpdate(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Subscribe to push notifications
 * @param applicationServerKey - The public VAPID key
 * @returns Push subscription or null if failed
 */
export async function subscribeToPush(
  applicationServerKey: string
): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.error("[SW] Push notifications not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Convert base64url to Uint8Array
    const applicationServerKeyArray = urlBase64ToUint8Array(applicationServerKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKeyArray as BufferSource,
    });

    return subscription;
  } catch (error) {
    console.error("[SW] Failed to subscribe to push:", error);
    return null;
  }
}

/**
 * Get the current push subscription
 * @returns Current subscription or null
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch {
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 * @returns True if unsubscribed successfully
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const subscription = await getPushSubscription();
    if (subscription) {
      return await subscription.unsubscribe();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Convert a push subscription to our internal format
 * @param subscription - Browser PushSubscription
 * @returns Our PushSubscription type
 */
export function convertPushSubscription(subscription: PushSubscription): PushSubType {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh: json.keys?.p256dh || "",
      auth: json.keys?.auth || "",
    },
  };
}

/**
 * Show a local notification via the service worker
 * @param payload - Notification payload
 */
export async function showNotification(payload: PushNotificationPayload): Promise<void> {
  await sendMessageToServiceWorker({
    type: "SHOW_NOTIFICATION",
    payload,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a base64url encoded string to a Uint8Array
 * Used for applicationServerKey in push subscription
 * @param base64String - Base64url encoded string
 * @returns Uint8Array
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Add padding if needed
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    // Convert base64url to base64
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Convert a Uint8Array to a base64url encoded string
 * @param array - Uint8Array to convert
 * @returns Base64url encoded string
 */
export function uint8ArrayToBase64Url(array: Uint8Array): string {
  const binary = String.fromCharCode.apply(null, Array.from(array));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Listen for navigation messages from the service worker
 * @param callback - Callback to handle navigation
 */
export function onNavigateMessage(callback: (url: string) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === "NAVIGATE" && event.data?.url) {
      callback(event.data.url);
    }
  };

  navigator.serviceWorker.addEventListener("message", handler);

  // Return cleanup function
  return () => {
    navigator.serviceWorker.removeEventListener("message", handler);
  };
}

/**
 * Wait for the service worker to be ready
 * @param timeout - Maximum time to wait in ms (default: 10000)
 * @returns The service worker registration or null if timeout
 */
export async function waitForServiceWorkerReady(
  timeout: number = 10000
): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout waiting for service worker")), timeout)
      ),
    ]);
    return registration;
  } catch {
    return null;
  }
}
