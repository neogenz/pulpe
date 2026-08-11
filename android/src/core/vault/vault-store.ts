import { create } from "zustand";

import { normalizeApiError } from "@/core/api/api-error";
import {
  clearAllKeys,
  clearSessionKey,
  disableBiometricUnlock,
  enableBiometricUnlock,
  hasBiometricKey,
  resolveViaBiometric,
  restoreClientKey,
  storeClientKey,
} from "@/core/crypto/client-key-manager";
import { deriveClientKey } from "@/core/crypto/pbkdf2";
import { queryClient } from "@/core/query/query-client";

import {
  changePin,
  fetchSalt,
  fetchVaultStatus,
  recoverVault,
  regenerateRecoveryKey,
  setupRecoveryKey,
  validateClientKey,
  verifyRecoveryKey,
} from "./vault-api";

/**
 * `unknown` is the bootstrap state, not an error: the app cannot tell a vault
 * that needs setting up from one that is merely locked until the server has
 * answered.
 */
export type VaultStatus = "unknown" | "setupRequired" | "locked" | "unlocked";

/**
 * A recovery key is shown once and never again, and minting one is the last
 * step of both setup and recovery — the two moments where the vault flips to
 * `unlocked` and the router drops the screen that did the minting. So the
 * notice lives at app level, above any route that could be unmounted under it.
 */
export type RecoveryKeyNotice =
  | { kind: "minted"; recoveryKey: string }
  | { kind: "mintFailed" };

interface VaultState {
  status: VaultStatus;
  isBiometricAvailable: boolean;
  /** Non-null only while `status` is `unknown`: the reason it is still unknown. */
  bootstrapError: string | null;
  pendingRecoveryNotice: RecoveryKeyNotice | null;
}

export const useVaultStore = create<VaultState>(() => ({
  status: "unknown",
  isBiometricAvailable: false,
  bootstrapError: null,
  pendingRecoveryNotice: null,
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
 *
 * Never rejects: the router waits on this state, and an exception nobody is
 * positioned to catch would leave it on a blank screen with no way forward.
 * A failure becomes `bootstrapError`, which the retry screen reads.
 */
export async function bootstrapVault(): Promise<void> {
  setState({ bootstrapError: null });

  try {
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
  } catch (error) {
    setState({
      status: "unknown",
      bootstrapError: normalizeApiError(error).message,
    });
  }
}

/**
 * First-time setup. `setup-recovery` is what initialises the server-side key
 * check, so it has to run before `validate-key` could ever succeed — the order
 * here is load-bearing, not stylistic.
 */
export async function setupVaultPin(pin: string): Promise<void> {
  try {
    await deriveAndHold(pin);
    const { recoveryKey } = await setupRecoveryKey();
    setState({
      status: "unlocked",
      pendingRecoveryNotice: { kind: "minted", recoveryKey },
    });
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
 * spent by this call, so a fresh one is minted to replace it.
 *
 * Minting runs past the commit point: the data is already rewrapped by then,
 * so its failure costs the user a recovery key, never their access — which is
 * why it does not undo anything, it only changes what the notice says.
 */
export async function recoverVaultWithKey(
  recoveryKey: string,
  newPin: string,
): Promise<void> {
  const { salt, kdfIterations } = await fetchSalt();
  const newClientKeyHex = await deriveClientKey(newPin, salt, kdfIterations);

  await recoverVault(recoveryKey, newClientKeyHex);
  await storeClientKey(newClientKeyHex, { enableBiometric: false });

  let notice: RecoveryKeyNotice = { kind: "mintFailed" };
  try {
    const { recoveryKey: nextRecoveryKey } = await regenerateRecoveryKey();
    notice = { kind: "minted", recoveryKey: nextRecoveryKey };
  } catch {
    // Deliberately swallowed — see above.
  }

  setState({ status: "unlocked", pendingRecoveryNotice: notice });
}

/**
 * Changes the PIN while the vault is open.
 *
 * The server rewraps under the new key, so the device slot has to follow in the
 * same breath: a stored key that no longer matches the vault would fail the
 * next validation and send the user to recovery for a change they just made.
 * A biometric slot is re-armed from the new key, or dropped if it cannot be.
 *
 * The endpoint also mints a replacement recovery key — the old one stops
 * working here — so it goes through the same show-once notice as setup. Losing
 * it silently would leave the user holding a key that no longer opens anything.
 */
export async function changeVaultPin(
  oldPin: string,
  newPin: string,
): Promise<void> {
  const { salt, kdfIterations } = await fetchSalt();
  const [oldClientKeyHex, newClientKeyHex] = await Promise.all([
    deriveClientKey(oldPin, salt, kdfIterations),
    deriveClientKey(newPin, salt, kdfIterations),
  ]);

  const hadBiometric = await hasBiometricKey();
  const { recoveryKey } = await changePin(oldClientKeyHex, newClientKeyHex);
  await storeClientKey(newClientKeyHex, { enableBiometric: false });

  if (hadBiometric) {
    await disableBiometricUnlock();
    setState({ isBiometricAvailable: await enableBiometricUnlock() });
  }

  setState({ pendingRecoveryNotice: { kind: "minted", recoveryKey } });
}

/**
 * Mints a replacement recovery key. The old one stops working the moment this
 * returns, so the new one goes through the same show-once notice as setup.
 */
export async function renewRecoveryKey(): Promise<void> {
  const { recoveryKey } = await regenerateRecoveryKey();
  setState({ pendingRecoveryNotice: { kind: "minted", recoveryKey } });
}

/** Checks a written-down key against the vault without spending it. */
export async function checkRecoveryKey(recoveryKey: string): Promise<void> {
  await verifyRecoveryKey(recoveryKey);
}

/** Arms unlock-by-biometrics from the key already held for this session. */
export async function enableVaultBiometrics(): Promise<boolean> {
  const isEnabled = await enableBiometricUnlock();
  setState({ isBiometricAvailable: isEnabled });
  return isEnabled;
}

export async function disableVaultBiometrics(): Promise<void> {
  await disableBiometricUnlock();
  setState({ isBiometricAvailable: false });
}

/** The user says they have written the key down; it is unrecoverable after this. */
export function acknowledgeRecoveryNotice(): void {
  setState({ pendingRecoveryNotice: null });
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
  setState({
    status: "unknown",
    isBiometricAvailable: false,
    bootstrapError: null,
    pendingRecoveryNotice: null,
  });
}
