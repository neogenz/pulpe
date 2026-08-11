import { QueryClient } from "@tanstack/react-query";

const STALE_TIME_MS = 30_000;

/**
 * A module singleton rather than a provider-owned instance: signing out has to
 * clear the cache from `session-store`, which has no React context to read.
 *
 * The 30s stale window matches the TTL the iOS stores use, so the two clients
 * refetch on the same rhythm.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      retry: false,
    },
  },
});
