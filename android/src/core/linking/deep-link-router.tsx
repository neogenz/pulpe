import { useLinkingURL } from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef } from "react";

import { useSessionStore } from "@/core/auth/session-store";
import { useVaultStore } from "@/core/vault/vault-store";

import { type DeepLink, parseDeepLink, requestAddExpense } from "./deep-links";

/**
 * Routes `pulpe://` links, holding them until there is somewhere to route them
 * to. A link that arrives on a locked vault or a signed-out app cannot be
 * followed — the destination route does not exist yet, `Stack.Protected` having
 * removed the whole group — so it waits for the unlock rather than being lost.
 *
 * Renders nothing; mount it once inside the navigator.
 */
export function DeepLinkRouter() {
  const url = useLinkingURL();
  const sessionStatus = useSessionStore((state) => state.status);
  const vaultStatus = useVaultStore((state) => state.status);
  const pendingRef = useRef<DeepLink | null>(null);

  const isReady =
    sessionStatus === "authenticated" && vaultStatus === "unlocked";

  useEffect(() => {
    if (url !== null) {
      const link = parseDeepLink(url);
      // A URL this router does not own leaves any pending link untouched:
      // the reset-password link arriving mid-wait must not drop it.
      if (link !== null) pendingRef.current = link;
    }

    const pending = pendingRef.current;
    if (!isReady || pending === null) return;

    // Cleared before navigating, so a re-render mid-transition cannot fire the
    // same link twice.
    pendingRef.current = null;
    if (pending.kind === "budget") {
      router.push(`/budget/${pending.budgetId}`);
      return;
    }
    requestAddExpense();
    router.push("/home");
  }, [url, isReady]);

  return null;
}
