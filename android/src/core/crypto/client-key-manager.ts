import * as SecureStore from "expo-secure-store";

import { isValidClientKeyHex } from "./client-key-format";

/**
 * Owns the client key's lifetime, mirroring `ClientKeyManager.swift`.
 *
 * One persistent slot, because a cold launch must always relock the vault:
 *
 * - **biometric** is gated behind the device's own authentication and is what
 *   makes "unlock with your fingerprint" possible without ever re-deriving from
 *   the PIN. It deliberately survives `clearSession`, so a locked vault can
 *   still be reopened biometrically — only a full sign-out removes it.
 *
 * The key never leaves memory as anything but these two entries, and a
 * malformed value read back from either slot is treated as absent: a truncated
 * key would otherwise be sent as `X-Client-Key` and decrypt nothing, which
 * surfaces as wrong amounts rather than as an error.
 */

const STANDARD_KEY_SLOT = "pulpe.clientKey";
const BIOMETRIC_KEY_SLOT = "pulpe.clientKey.biometric";

const BIOMETRIC_PROMPT = "Déverrouille Pulpe";

/**
 * Read synchronously by `ApiClient` on every request, so it cannot be a
 * promise. Everything that can populate it is awaited before the app leaves the
 * unlock screen.
 */
let cachedClientKeyHex: string | null = null;

export function getCachedClientKey(): string | null {
  return cachedClientKeyHex;
}

export function hasClientKey(): boolean {
  return cachedClientKeyHex !== null;
}

async function readSlot(
  slot: string,
  options?: SecureStore.SecureStoreOptions,
): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(slot, options);
  if (stored === null) return null;
  if (!isValidClientKeyHex(stored)) {
    await SecureStore.deleteItemAsync(slot, options);
    return null;
  }
  return stored;
}

/** Cold-start migration: a legacy ungated key must never unlock the vault. */
export async function clearLegacyClientKey(): Promise<void> {
  cachedClientKeyHex = null;
  await SecureStore.deleteItemAsync(STANDARD_KEY_SLOT);
}

export async function hasBiometricKey(): Promise<boolean> {
  // Presence is checked without `requireAuthentication`, so asking the question
  // does not prompt: the unlock screen needs to know whether to offer the
  // biometric button before the user has decided to use it.
  const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY_SLOT);
  return stored !== null;
}

/**
 * Prompts for biometric authentication and keeps the key in memory for the
 * rest of the process.
 */
export async function resolveViaBiometric(): Promise<string | null> {
  const hex = await readSlot(BIOMETRIC_KEY_SLOT, {
    requireAuthentication: true,
    authenticationPrompt: BIOMETRIC_PROMPT,
  });
  if (hex === null) return null;

  cachedClientKeyHex = hex;
  return hex;
}

/** Stores the key after the server has validated it. */
export async function storeClientKey(
  clientKeyHex: string,
  { enableBiometric }: { enableBiometric: boolean },
): Promise<void> {
  cachedClientKeyHex = clientKeyHex;

  if (enableBiometric) {
    await enableBiometricUnlock();
  }
}

/**
 * Fails closed: writing an authenticated slot throws when the user dismisses
 * the prompt or the device has nothing enrolled, and a caller told the slot
 * exists when it does not would offer an unlock that can never work.
 */
export async function enableBiometricUnlock(): Promise<boolean> {
  if (cachedClientKeyHex === null) return false;

  try {
    await SecureStore.setItemAsync(BIOMETRIC_KEY_SLOT, cachedClientKeyHex, {
      requireAuthentication: true,
      authenticationPrompt: BIOMETRIC_PROMPT,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * No `requireAuthentication` here, and none in `clearAllKeys` either: on
 * Android `deleteItemImpl` never reads that option — it removes three
 * `SharedPreferences` entries and returns. Passing it made these two reads as
 * though dropping a slot were gated behind a prompt, which it is not, and the
 * next person to trust that reading would have built on it.
 */
export async function disableBiometricUnlock(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY_SLOT);
}

/** Locks the vault, keeping biometric unlock available. */
export async function clearSessionKey(): Promise<void> {
  cachedClientKeyHex = null;
  await SecureStore.deleteItemAsync(STANDARD_KEY_SLOT);
}

/** Sign-out: nothing about this account survives on the device. */
export async function clearAllKeys(): Promise<void> {
  cachedClientKeyHex = null;
  await SecureStore.deleteItemAsync(STANDARD_KEY_SLOT);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY_SLOT);
}
