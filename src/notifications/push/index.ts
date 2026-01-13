/**
 * Web Push notification module exports
 *
 * This module provides Web Push notification functionality including:
 * - VAPID key generation and management
 * - Push notification client for sending notifications
 * - Subscription storage and management
 */

// Types
export {
  PushNotificationStatus,
  PushSubscriptionState,
  PushUrgency,
  type VapidKeys,
  type PushServiceConfig,
  type PushSubscriptionKeys,
  type PushSubscription,
  type PushSubscriptionRecord,
  type PushNotificationPayload,
  type PushNotificationAction,
  type PushNotificationMessage,
  type PushMessageOptions,
  type PushSendResult,
  type PushBatchOptions,
  type PushBatchResult,
  type PushEventType,
  type PushEvent,
  type PushEventHandler,
  type PushSubscriptionStorage,
  type PushStatistics,
  // Validation functions
  isValidVapidPublicKey,
  isValidVapidPrivateKey,
  isValidPushEndpoint,
  hasValidSubscriptionKeys,
  isValidPushSubscription,
  isValidVapidKeys,
  extractPushServiceDomain,
  identifyPushService,
  generateSubscriptionId,
  generateResultId,
  truncateEndpoint,
  calculateTtlByUrgency,
  isValidNotificationPayload,
  truncatePayload,
  DEFAULT_PUSH_CONFIG,
} from "./types";

// VAPID utilities
export {
  VapidError,
  generateVapidKeys,
  base64urlEncode,
  base64urlDecode,
  validateVapidKeys,
  createVapidKeys,
  loadVapidKeysFromEnv,
  generateVapidKeysEnvString,
  createVapidAuthHeader,
  getAudienceFromEndpoint,
  formatCryptoKeyHeader,
  getVapidKeys,
  setVapidKeys,
  resetVapidKeys,
  hasVapidKeys,
} from "./vapid";

// Push client
export {
  PushClient,
  PushClientError,
  getPushClient,
  createPushClient,
  resetPushClient,
  isPushClientInitialized,
} from "./client";

// Storage
export {
  StorageError,
  InMemoryPushStorage,
  PushSubscriptionManager,
  getDefaultStorage,
  getSubscriptionManager,
  resetStorage,
  createInMemoryStorage,
  createSubscriptionManager,
} from "./storage";

// Service Worker utilities (client-side only)
export {
  // Types
  type ServiceWorkerMessageType,
  type ServiceWorkerMessageBase,
  type GetVersionMessage,
  type SkipWaitingMessage,
  type ShowNotificationMessage,
  type ServiceWorkerMessage,
  type VersionResponse,
  type NavigateMessage,
  ServiceWorkerState,
  type ServiceWorkerRegistrationResult,
  type ServiceWorkerUpdateResult,
  // Functions
  isServiceWorkerSupported,
  isPushSupported,
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  getServiceWorkerRegistration,
  unregisterServiceWorker,
  sendMessageToServiceWorker,
  getServiceWorkerVersion,
  checkForUpdates,
  applyUpdate,
  subscribeToPush,
  getPushSubscription,
  unsubscribeFromPush,
  convertPushSubscription,
  showNotification,
  urlBase64ToUint8Array,
  uint8ArrayToBase64Url,
  onNavigateMessage,
  waitForServiceWorkerReady,
} from "./service-worker";
