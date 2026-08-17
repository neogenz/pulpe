import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

import { clearAllKeys } from "@/core/crypto/client-key-manager";
import { forgetLandingPreference } from "@/core/navigation/landing-preference";
import { queryClient } from "@/core/query/query-client";
import { resetVault } from "@/core/vault/vault-store";

import { signOutEverywhere, signOutThisDevice, supabase } from "./supabase";

/**
 * A signed-in session says nothing about the vault, so `locked` is deliberately
 * not one of these: it belongs to `VaultStatus`, which the router reads
 * alongside this one. Two states in one enum would let a caller branch on a
 * combination that cannot happen.
 */
export type SessionStatus = "loading" | "unauthenticated" | "authenticated";

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
}

function applySession(session: Session | null): Partial<SessionState> {
  return {
    status: session ? "authenticated" : "unauthenticated",
    session,
    user: session?.user ?? null,
  };
}

export const useSessionStore = create<SessionState>((set) => ({
  status: "loading",
  session: null,
  user: null,

  signOut: async () => {
    await signOutThisDevice();
    await purgeLocalAccountData();
    set(applySession(null));
  },
}));

/**
 * Ends a password-recovery session. The purge is awaited here rather than left
 * to the `SIGNED_OUT` listener, because the caller navigates as soon as this
 * resolves and would otherwise race the vault reset.
 */
export async function endRecoverySession(): Promise<void> {
  try {
    await signOutEverywhere();
  } finally {
    try {
      await purgeLocalAccountData();
    } finally {
      useSessionStore.setState(applySession(null));
    }
  }
}

/**
 * Everything the departing account left behind. Idempotent, because it runs
 * both from the explicit sign-out — where the caller awaits it before the UI
 * moves on — and from the `SIGNED_OUT` listener, which also fires when the
 * server revokes the session under us.
 */
async function purgeLocalAccountData(): Promise<void> {
  // Cached budget data belongs to the account that just left the device.
  queryClient.clear();
  resetVault();
  forgetLandingPreference();
  await clearAllKeys();
}

/**
 * Restores the persisted session, then keeps the store in step with
 * supabase-js. Token refreshes and expiry both arrive through this listener,
 * so the store never has to poll.
 */
export function observeSession(): () => void {
  void supabase.auth
    .getSession()
    .then(({ data }) => useSessionStore.setState(applySession(data.session)));

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") void purgeLocalAccountData();
    useSessionStore.setState(applySession(session));
  });

  return () => data.subscription.unsubscribe();
}
