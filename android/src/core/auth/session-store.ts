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

interface AccountTeardownResult {
  providerError: unknown | null;
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
    const { providerError } = await teardownAccount(signOutThisDevice);
    if (providerError !== null) throw providerError;
  },
}));

/**
 * Ends a password-recovery session. The purge is awaited here rather than left
 * to the `SIGNED_OUT` listener, because the caller navigates as soon as this
 * resolves and would otherwise race the vault reset.
 */
export async function endRecoverySession(): Promise<AccountTeardownResult> {
  return teardownAccount(signOutEverywhere);
}

/**
 * The provider call and local teardown are deliberately separate. Supabase can
 * reject a revocation while still removing its local session; conversely, a
 * storage failure must never be hidden by publishing the anonymous state.
 */
async function teardownAccount(
  providerSignOut: () => Promise<void>,
): Promise<AccountTeardownResult> {
  let providerError: unknown | null = null;
  let localError: unknown | null = null;

  try {
    await providerSignOut();
  } catch (error) {
    providerError = error;
  }

  // A global sign-out can fail before supabase-js removes its stored session.
  // The public local API is idempotent, so run it unconditionally and then ask
  // the client to read its own adapter instead of depending on its private key.
  try {
    await signOutThisDevice();
  } catch (error) {
    providerError ??= error;
  }

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session !== null) {
      throw new Error("The persisted Supabase session could not be removed");
    }
  } catch (error) {
    localError = error;
  }

  try {
    await purgeLocalAccountData();
  } catch (error) {
    localError ??= error;
  } finally {
    useSessionStore.setState(applySession(null));
  }

  if (localError !== null) throw providerError ?? localError;
  return { providerError };
}

/**
 * Everything the departing account left behind. Every cleanup is attempted so
 * one failing storage backend cannot keep the later vault or key purge from
 * running. The first failure is retained for the caller.
 */
async function purgeLocalAccountData(): Promise<void> {
  let firstError: unknown | null = null;
  const cleanupSteps: (() => void | Promise<void>)[] = [
    () => queryClient.clear(),
    () => resetVault(),
    () => forgetLandingPreference(),
    () => clearAllKeys(),
  ];

  for (const cleanup of cleanupSteps) {
    try {
      await cleanup();
    } catch (error) {
      firstError ??= error;
    }
  }

  if (firstError !== null) throw firstError;
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
    if (event === "SIGNED_OUT") void purgeLocalAccountData().catch(() => {});
    useSessionStore.setState(applySession(session));
  });

  return () => data.subscription.unsubscribe();
}
