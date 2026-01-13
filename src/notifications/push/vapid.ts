/**
 * VAPID (Voluntary Application Server Identification) key utilities
 * for Web Push notifications
 *
 * VAPID is used to identify the application server to push services
 * and ensures that only your server can send notifications to your subscribers.
 */

import * as crypto from "crypto";
import type { VapidKeys } from "./types";
import { isValidVapidPublicKey, isValidVapidPrivateKey, isValidVapidKeys } from "./types";

/**
 * Error class for VAPID-related errors
 */
export class VapidError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "VapidError";
  }
}

/**
 * Generate a new VAPID key pair
 *
 * This generates P-256 (prime256v1) elliptic curve keys suitable for VAPID.
 * The keys are returned in base64url encoding as required by the Web Push API.
 *
 * @param subject - Contact email (mailto:) or URL (https://) for push service communication
 * @returns VapidKeys object with public key, private key, and subject
 * @throws VapidError if key generation fails
 *
 * @example
 * ```typescript
 * const keys = generateVapidKeys("mailto:admin@example.com");
 * console.log(keys.publicKey); // Use this in the frontend
 * console.log(keys.privateKey); // Keep this secret on the server
 * ```
 */
export function generateVapidKeys(subject: string): VapidKeys {
  // Validate subject
  if (!subject || typeof subject !== "string") {
    throw new VapidError("Subject is required", "INVALID_SUBJECT");
  }
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    throw new VapidError(
      "Subject must be a mailto: email or https:// URL",
      "INVALID_SUBJECT_FORMAT"
    );
  }

  try {
    // Generate P-256 EC key pair
    const keyPair = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });

    // Export public key in uncompressed format
    const publicKeyBuffer = keyPair.publicKey.export({
      type: "spki",
      format: "der",
    });

    // Export private key
    const privateKeyBuffer = keyPair.privateKey.export({
      type: "pkcs8",
      format: "der",
    });

    // Extract the raw public key (skip the SPKI header - last 65 bytes)
    // SPKI format: 26 byte header + 65 byte uncompressed public key
    const rawPublicKey = publicKeyBuffer.subarray(-65);

    // Extract the raw private key (skip the PKCS8 header - 32 bytes at offset)
    // PKCS8 for P-256: header + 32 byte private key + public key info
    // The private key is at bytes 36-68 in the DER encoding
    const rawPrivateKey = privateKeyBuffer.subarray(36, 68);

    // Convert to base64url encoding
    const publicKey = base64urlEncode(rawPublicKey);
    const privateKey = base64urlEncode(rawPrivateKey);

    return {
      publicKey,
      privateKey,
      subject,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new VapidError(`Failed to generate VAPID keys: ${message}`, "KEY_GENERATION_FAILED");
  }
}

/**
 * Encode a Buffer to base64url string
 *
 * Base64url is base64 with:
 * - '+' replaced with '-'
 * - '/' replaced with '_'
 * - Padding '=' removed
 */
export function base64urlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a base64url string to Buffer
 */
export function base64urlDecode(str: string): Buffer {
  // Add back padding if needed
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = 4 - (base64.length % 4);
  if (padding !== 4) {
    base64 += "=".repeat(padding);
  }
  return Buffer.from(base64, "base64");
}

/**
 * Validate VAPID keys are properly formatted and can be used
 *
 * @param keys - VapidKeys to validate
 * @returns true if keys are valid, false otherwise
 */
export function validateVapidKeys(keys: VapidKeys): boolean {
  return isValidVapidKeys(keys);
}

/**
 * Create VapidKeys from existing key strings
 *
 * @param publicKey - Base64url encoded public key
 * @param privateKey - Base64url encoded private key
 * @param subject - Contact email or URL
 * @returns VapidKeys object
 * @throws VapidError if keys are invalid
 */
export function createVapidKeys(publicKey: string, privateKey: string, subject: string): VapidKeys {
  if (!isValidVapidPublicKey(publicKey)) {
    throw new VapidError("Invalid VAPID public key format", "INVALID_PUBLIC_KEY");
  }
  if (!isValidVapidPrivateKey(privateKey)) {
    throw new VapidError("Invalid VAPID private key format", "INVALID_PRIVATE_KEY");
  }
  if (!subject || (!subject.startsWith("mailto:") && !subject.startsWith("https://"))) {
    throw new VapidError("Invalid subject format", "INVALID_SUBJECT");
  }

  return { publicKey, privateKey, subject };
}

/**
 * Load VAPID keys from environment variables
 *
 * Expected environment variables:
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - VAPID_SUBJECT (or EMAIL_FROM for fallback)
 *
 * @returns VapidKeys if environment variables are set, null otherwise
 */
export function loadVapidKeysFromEnv(): VapidKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || (process.env.EMAIL_FROM ? `mailto:${process.env.EMAIL_FROM}` : "");

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  try {
    return createVapidKeys(publicKey, privateKey, subject);
  } catch {
    return null;
  }
}

/**
 * Generate VAPID keys and save to environment format
 *
 * Returns a string that can be added to .env file
 *
 * @param subject - Contact email or URL
 * @returns Environment variable string
 */
export function generateVapidKeysEnvString(subject: string): string {
  const keys = generateVapidKeys(subject);
  return [
    "# Web Push VAPID Keys",
    "# Generated for Web Push notifications",
    `VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    `VAPID_SUBJECT=${keys.subject}`,
  ].join("\n");
}

/**
 * Create a VAPID authorization header JWT
 *
 * This creates the JWT that's used in the Authorization header
 * when sending push notifications.
 *
 * @param audience - The origin of the push service (e.g., https://fcm.googleapis.com)
 * @param subject - Contact email or URL
 * @param publicKey - Base64url encoded public key
 * @param privateKey - Base64url encoded private key
 * @param expiration - JWT expiration time in seconds from now (default 12 hours)
 * @returns JWT string for Authorization header
 */
export function createVapidAuthHeader(
  audience: string,
  subject: string,
  _publicKey: string,
  privateKey: string,
  expiration: number = 12 * 60 * 60
): string {
  const now = Math.floor(Date.now() / 1000);

  // JWT Header
  const header = {
    typ: "JWT",
    alg: "ES256",
  };

  // JWT Payload
  const payload = {
    aud: audience,
    exp: now + expiration,
    sub: subject,
  };

  // Encode header and payload
  const headerB64 = base64urlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(payload)));

  // Create signature input
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Create EC key object from raw private key
  const privateKeyBuffer = base64urlDecode(privateKey);
  const keyObject = crypto.createPrivateKey({
    key: Buffer.concat([
      // PKCS8 header for P-256 private key
      Buffer.from([
        0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
        0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25,
        0x02, 0x01, 0x01, 0x04, 0x20,
      ]),
      privateKeyBuffer,
    ]),
    format: "der",
    type: "pkcs8",
  });

  // Sign with ES256 (ECDSA with P-256 and SHA-256)
  const signature = crypto.sign("sha256", Buffer.from(signatureInput), {
    key: keyObject,
    dsaEncoding: "ieee-p1363",
  });

  const signatureB64 = base64urlEncode(signature);

  return `${signatureInput}.${signatureB64}`;
}

/**
 * Extract the audience (origin) from a push endpoint
 *
 * @param endpoint - Push subscription endpoint URL
 * @returns Origin URL for VAPID audience
 */
export function getAudienceFromEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.origin;
  } catch {
    throw new VapidError("Invalid endpoint URL", "INVALID_ENDPOINT");
  }
}

/**
 * Format for the Crypto-Key header
 *
 * @param publicKey - Base64url encoded public key
 * @returns Crypto-Key header value
 */
export function formatCryptoKeyHeader(publicKey: string): string {
  return `p256ecdsa=${publicKey}`;
}

/**
 * Stored VAPID keys for singleton pattern
 */
let storedVapidKeys: VapidKeys | null = null;

/**
 * Get or create VAPID keys (singleton pattern)
 *
 * First tries to load from environment, then uses stored keys.
 * If no keys exist, returns null (keys must be explicitly generated).
 *
 * @returns VapidKeys if available, null otherwise
 */
export function getVapidKeys(): VapidKeys | null {
  // Try environment first
  const envKeys = loadVapidKeysFromEnv();
  if (envKeys) {
    storedVapidKeys = envKeys;
    return envKeys;
  }

  // Return stored keys
  return storedVapidKeys;
}

/**
 * Set VAPID keys for use by the application
 *
 * @param keys - VapidKeys to store
 */
export function setVapidKeys(keys: VapidKeys): void {
  if (!validateVapidKeys(keys)) {
    throw new VapidError("Invalid VAPID keys", "INVALID_KEYS");
  }
  storedVapidKeys = keys;
}

/**
 * Reset stored VAPID keys (useful for testing)
 */
export function resetVapidKeys(): void {
  storedVapidKeys = null;
}

/**
 * Check if VAPID keys are configured
 *
 * @returns true if VAPID keys are available
 */
export function hasVapidKeys(): boolean {
  return getVapidKeys() !== null;
}
