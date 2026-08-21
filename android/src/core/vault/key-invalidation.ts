import { API_ERROR_CODES } from "pulpe-shared";

import { isApiError } from "@/core/api/api-error";
import { queryClient } from "@/core/query/query-client";

import { lockVault, useVaultStore } from "./vault-store";

/**
 * The three ways the server says "the key this device is holding cannot open
 * this vault". The first is the one a PIN changed on another device produces:
 * the header is a perfectly well-formed 32 bytes, it simply no longer derives
 * the DEK, and the check fails at 400 rather than 403 — the other two are the
 * guard rejecting the header itself.
 */
const KEY_REJECTION_CODES: readonly string[] = [
  API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED,
  API_ERROR_CODES.AUTH_CLIENT_KEY_MISSING,
  API_ERROR_CODES.AUTH_CLIENT_KEY_INVALID,
];

export function isVaultKeyRejected(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.code !== undefined &&
    KEY_REJECTION_CODES.includes(error.code)
  );
}

/**
 * Relocks the vault the first time a read or a write comes back with a key the
 * server will not accept — the webapp's auth interceptor does the same on its
 * own equivalent. Without it the app keeps a vault it believes is open around a
 * key that decrypts nothing, and every screen answers with the same error until
 * the user thinks to quit.
 *
 * The session is deliberately left alone: the account is fine, only the PIN
 * behind the key has moved, and signing out would cost a password to fix a
 * four-digit problem.
 */
export function observeVaultKeyRejection(): () => void {
  const relockIfRejected = (error: unknown) => {
    if (!isVaultKeyRejected(error)) return;
    // Anything but `unlocked` is already on its way to the PIN screen — the
    // unlock attempt itself answers with this very code on a wrong PIN.
    if (useVaultStore.getState().status !== "unlocked") return;
    void lockVault();
  };

  const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "error") {
      relockIfRejected(event.action.error);
    }
  });
  const unsubscribeMutations = queryClient
    .getMutationCache()
    .subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        relockIfRejected(event.action.error);
      }
    });

  return () => {
    unsubscribeQueries();
    unsubscribeMutations();
  };
}
