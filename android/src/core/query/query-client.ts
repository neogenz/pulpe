import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";

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

/**
 * What "window focus" means for an app: coming back to the foreground.
 * TanStack's own listener waits for the document's `visibilitychange`, which
 * React Native does not have, so stale queries were never refetched on return —
 * an expense recorded on the web or on iOS stayed missing here until a manual
 * pull.
 */
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener("change", (state) =>
    setFocused(state === "active"),
  );
  return () => subscription.remove();
});
