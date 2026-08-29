import { hashKey, type QueryKey } from "@tanstack/react-query";

import { isApiError } from "@/core/api/api-error";
import { queryClient } from "@/core/query/query-client";
import { isVaultKeyRejected } from "@/core/vault/key-rejection";

import { useSessionStore } from "./session-store";
import { supabase } from "./supabase";

const HTTP_UNAUTHORIZED = 401;

let recovery: Promise<boolean> | null = null;

/**
 * One refresh for a whole burst of 401s, and one sign-out if it fails: every
 * screen that failed in the same tick waits on the same promise. Resolves to
 * whether the session was refreshed.
 */
function recoverSession(): Promise<boolean> {
  recovery ??= (async () => {
    const isRefreshed = await supabase.auth.refreshSession().then(
      ({ data, error }) => error === null && data.session !== null,
      () => false,
    );
    if (!isRefreshed) {
      // Scoped to this device: the account is fine, only this session died.
      await useSessionStore
        .getState()
        .signOut()
        .catch(() => undefined);
    }
    return isRefreshed;
  })().finally(() => {
    recovery = null;
  });
  return recovery;
}

/**
 * A session revoked elsewhere — the webapp's global sign-out, an expiry the
 * auto-refresh missed — answers every request with 401 and, left alone, every
 * screen with the same error until the user quits. Refresh once; with a new
 * token the failed query refetches and the user notices nothing, without one
 * the device signs out locally and `index` sends it to sign-in.
 *
 * A query refetched with a fresh token gets no second refresh: a 401 that
 * survives the refresh is the API refusing this account, not an expired
 * session, and refreshing again would only loop. It surfaces as the query's
 * error until the query succeeds again.
 *
 * 403 and the key rejection codes are somebody else's: the guard refusing a
 * header is `key-invalidation.ts`'s job, and a forbidden resource is not a
 * dead session.
 */
export function observeSessionRejection(): () => void {
  const retriedKeys = new Set<string>();

  const recoverIfRejected = (error: unknown, queryKey?: QueryKey) => {
    if (!isApiError(error) || error.status !== HTTP_UNAUTHORIZED) return;
    if (isVaultKeyRejected(error)) return;
    if (useSessionStore.getState().status !== "authenticated") return;
    if (queryKey !== undefined && retriedKeys.has(hashKey(queryKey))) return;

    void recoverSession().then((isRefreshed) => {
      if (isRefreshed && queryKey !== undefined) {
        retriedKeys.add(hashKey(queryKey));
        void queryClient.invalidateQueries({ queryKey });
      }
    });
  };

  const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    if (event.action.type === "error") {
      recoverIfRejected(event.action.error, event.query.queryKey);
    } else if (event.action.type === "success") {
      retriedKeys.delete(hashKey(event.query.queryKey));
    }
  });
  const unsubscribeMutations = queryClient
    .getMutationCache()
    .subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        recoverIfRejected(event.action.error);
      }
    });

  return () => {
    unsubscribeQueries();
    unsubscribeMutations();
  };
}
