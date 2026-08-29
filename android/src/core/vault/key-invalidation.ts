import { queryClient } from "@/core/query/query-client";

import { isVaultKeyRejected } from "./key-rejection";
import { lockVault, useVaultStore } from "./vault-store";

// A leaf module, so `vault-store` can ask the same question without a cycle.
export { isVaultKeyRejected } from "./key-rejection";

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
