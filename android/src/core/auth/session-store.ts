import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

import { clearAllKeys } from "@/core/crypto/client-key-manager";
import { languageWriter } from "@/core/i18n/language-writer";
import { clearLocaleSnapshot } from "@/core/i18n/locale-store";
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
export type SessionStatus =
  | "loading"
  | "error"
  | "unauthenticated"
  | "authenticated";

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  user: User | null;
  retrySessionRestore: () => Promise<void>;
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

let accountTeardown: Promise<void> | null = null;
let sessionRestore: Promise<void> | null = null;
let authEventRevision = 0;
let authEventQueue = Promise.resolve();

export const useSessionStore = create<SessionState>((set) => ({
  status: "loading",
  session: null,
  user: null,

  retrySessionRestore: () => restorePersistedSession(false),

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
  // A successful local sign-out, however, must not be repeated merely because
  // its SIGNED_OUT listener shares the same teardown path.
  if (providerSignOut !== signOutThisDevice || providerError !== null) {
    try {
      await signOutThisDevice();
    } catch (error) {
      providerError ??= error;
    }
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
    await teardownLocalAccount();
  } catch (error) {
    localError ??= error;
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
    () => clearLocaleSnapshot(),
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

/** The only purge operation, shared by explicit and provider-driven sign-out. */
function teardownLocalAccount(): Promise<void> {
  if (accountTeardown !== null) return accountTeardown;
  if (useSessionStore.getState().status === "unauthenticated") {
    return Promise.resolve();
  }

  languageWriter.invalidate();
  const operation = (async () => {
    try {
      await purgeLocalAccountData();
    } finally {
      useSessionStore.setState(applySession(null));
    }
  })();
  accountTeardown = operation;
  const clear = () => {
    if (accountTeardown === operation) accountTeardown = null;
  };
  void operation.then(clear, clear);
  return operation;
}

async function waitForAccountTeardown(): Promise<void> {
  try {
    await accountTeardown;
  } catch {
    // Every cleanup was attempted and the anonymous state was published. A
    // later session must wait for that outcome, not inherit its storage error.
  }
}

function restorePersistedSession(showLoading: boolean): Promise<void> {
  if (sessionRestore !== null) return sessionRestore;
  if (showLoading) {
    useSessionStore.setState({ status: "loading", session: null, user: null });
  }

  const revision = authEventRevision;
  const operation = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      await waitForAccountTeardown();
      if (authEventRevision === revision) {
        useSessionStore.setState(applySession(data.session));
      }
    } catch {
      if (authEventRevision === revision) {
        useSessionStore.setState({
          status: "error",
          session: null,
          user: null,
        });
      }
    }
  })();
  sessionRestore = operation;
  const clear = () => {
    if (sessionRestore === operation) sessionRestore = null;
  };
  void operation.then(clear, clear);
  return operation;
}

async function applyAuthEvent(
  event: string,
  session: Session | null,
): Promise<void> {
  if (event === "SIGNED_OUT" || session === null) {
    if (
      accountTeardown === null &&
      useSessionStore.getState().status === "unauthenticated"
    ) {
      return;
    }
    try {
      await teardownLocalAccount();
    } catch {
      // The explicit caller receives the error. Provider listeners cannot, and
      // teardownLocalAccount has already attempted every cleanup.
    }
    return;
  }

  await waitForAccountTeardown();
  useSessionStore.setState(applySession(session));
}

/**
 * Restores the persisted session, then keeps the store in step with
 * supabase-js. Token refreshes and expiry both arrive through this listener,
 * so the store never has to poll.
 */
export function observeSession(): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    authEventRevision += 1;
    authEventQueue = authEventQueue
      .catch(() => undefined)
      .then(() => applyAuthEvent(event, session));
  });
  void restorePersistedSession(true);

  return () => data.subscription.unsubscribe();
}
