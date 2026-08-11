import { create } from "zustand";

import {
  clearAllKeys,
  clearSessionKey,
  hasBiometricKey,
  resolveViaBiometric,
  restoreClientKey,
  storeClientKey,
} from "@/core/crypto/client-key-manager";
import { deriveClientKey } from "@/core/crypto/pbkdf2";
import { queryClient } from "@/core/query/query-client";

import {
  fetchSalt,
  fetchVaultStatus,
  recoverVault,
  setupRecoveryKey,
  validateClientKey,
} from "./vault-api";

/**
 * `unknown` is the bootstrap state, not an error: the app cannot tell a vault
 * that needs setting up from one that is merely locked until the server has
 * answered.
 */
export type VaultStatus = "unknown" | "setupRequired" | "locked" | "unlocked";

interface VaultState {
  status: VaultStatus;
  isBiometricAvailable: boolean;
}

export const useVaultStore = create<VaultState>(() => ({
  status: "unknown",
  isBiometricAvailable: false,
}));

const setState = useVaultStore.setState;

/** Derives the key and leaves it in the API client's hands. */
async function deriveAndHold(pin: string): Promise<string> {
  const { salt, kdfIterations } = await fetchSalt();
  const clientKeyHex = await deriveClientKey(pin, salt, kdfIterations);

  // The key has to be readable by `ApiClient` before the next call goes out:
  // both `setup-recovery` and `validate-key` are authorised by the
  // `X-Client-Key` header, not by their body.
  await storeClientKey(clientKeyHex, { enableBiometric: false });
  return clientKeyHex;
}

/**
 * Decides between setup, unlock and a session that is already good, and is
 * safe to call again on every foreground.
 */
export async function bootstrapVault(): Promise<void> {
  const status = await fetchVaultStatus();

  if (!status.pinCodeConfigured) {
    setState({ status: "setupRequired", isBiometricAvailable: false });
    return;
  }

  const restored = await restoreClientKey();
  setState({
    status: restored ? "unlocked" : "locked",
    isBiometricAvailable: await hasBiometricKey(),
  });
}

/**
 * First-time setup. `setup-recovery` is what initialises the server-side key
 * check, so it has to run before `validate-key` could ever succeed — the order
 * here is load-bearing, not stylistic.
 *
 * Returns the recovery key, which is shown once and never retrievable again.
 */
export async function setupVaultPin(pin: string): Promise<string> {
  try {
    await deriveAndHold(pin);
    const { recoveryKey } = await setupRecoveryKey();
    setState({ status: "unlocked" });
    return recoveryKey;
  } catch (error) {
    // A half-set-up vault must not leave a key behind that the app would then
    // treat as an unlocked session.
    await clearSessionKey();
    setState({ status: "setupRequired" });
    throw error;
  }
}

export async function unlockVaultWithPin(pin: string): Promise<void> {
  try {
    const clientKeyHex = await deriveAndHold(pin);
    await validateClientKey(clientKeyHex);
    setState({ status: "unlocked" });
  } catch (error) {
    await clearSessionKey();
    setState({ status: "locked" });
    throw error;
  }
}

/** Returns false when the user dismissed the prompt or no slot exists. */
export async function unlockVaultWithBiometrics(): Promise<boolean> {
  const clientKeyHex = await resolveViaBiometric();
  if (clientKeyHex === null) return false;

  try {
    await validateClientKey(clientKeyHex);
    setState({ status: "unlocked" });
    return true;
  } catch (error) {
    // The stored key no longer matches the vault — a PIN change on another
    // device, most likely. Falling back to the PIN is the only way out.
    await clearAllKeys();
    setState({ status: "locked", isBiometricAvailable: false });
    throw error;
  }
}

/**
 * Rewraps the vault under a key derived from a new PIN. The recovery key is
 * spent by this call.
 */
export async function recoverVaultWithKey(
  recoveryKey: string,
  newPin: string,
): Promise<void> {
  const { salt, kdfIterations } = await fetchSalt();
  const newClientKeyHex = await deriveClientKey(newPin, salt, kdfIterations);

  await recoverVault(recoveryKey, newClientKeyHex);
  await storeClientKey(newClientKeyHex, { enableBiometric: false });
  setState({ status: "unlocked" });
}

/**
 * Locks without signing out. Cached data goes with it: it was decrypted with
 * the key that just left memory, so leaving it would show amounts the vault is
 * supposed to be hiding.
 */
export async function lockVault(): Promise<void> {
  await clearSessionKey();
  queryClient.clear();
  setState({
    status: "locked",
    isBiometricAvailable: await hasBiometricKey(),
  });
}

/** Sign-out: the next account starts from `unknown`, not from this one's state. */
export function resetVault(): void {
  setState({ status: "unknown", isBiometricAvailable: false });
}
