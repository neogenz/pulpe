import {
  isAuthRetryableFetchError,
  type Session,
  type User,
} from "@supabase/supabase-js";
import { create } from "zustand";

import {
  clearAllKeys,
  retireLegacyBiometricCandidate,
} from "@/core/crypto/client-key-manager";
import { languageWriter } from "@/core/i18n/language-writer";
import { clearLocaleSnapshot } from "@/core/i18n/locale-store";
import { forgetLandingPreference } from "@/core/navigation/landing-preference";
import { writeRemindersEnabled } from "@/core/notifications/reminder-flags";
import { cancelMonthlyReminder } from "@/core/notifications/scheduler";
import { queryClient } from "@/core/query/query-client";
import { resetVault } from "@/core/vault/vault-store";

import { forgetGoogleAccount } from "./google-sign-in";
import { clearRecoveryPending, isRecoveryPending } from "./password-recovery";
import {
  forgetPersistedSession,
  hasPersistedSession,
  signOutEverywhere,
  signOutThisDevice,
  supabase,
} from "./supabase";

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

  // Offline with an expired access token, supabase-js cannot load the session
  // it was asked to drop, and keeps it. Read through `getSession`, which
  // answers `null` in that case, the check below passed anyway.
  if (providerError !== null) {
    try {
      await forgetPersistedSession();
    } catch (error) {
      localError = error;
    }
  }

  try {
    if (await hasPersistedSession()) {
      throw new Error("The persisted Supabase session could not be removed");
    }
  } catch (error) {
    localError ??= error;
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
    // The reminder is the departing account's opt-in: left armed, it kept
    // firing after sign-out, and the next account on the device inherited it.
    () => cancelReminder(),
    () => writeRemindersEnabled(false),
    () => clearAllKeys(),
    () => forgetGoogleAccount(),
    () => clearRecoveryPending(),
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
 * Nothing scheduled is not a failed purge: the cancel can reject when no
 * reminder was ever armed, and that must not surface as a sign-out error.
 */
async function cancelReminder(): Promise<void> {
  try {
    await cancelMonthlyReminder();
  } catch {
    // Already gone, or never there — either way nothing is left to fire.
  }
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

/**
 * How long the splash waits on a restore. supabase-js retries a refresh with
 * backoff for about half a minute offline; past this, the retry screen is a
 * better answer than a frozen splash. A refresh that lands later still signs
 * the user in through `TOKEN_REFRESHED`. The timed-out read is left running:
 * a retry started meanwhile reads again alongside it, which is harmless, as
 * supabase-js serialises both behind its own lock.
 */
const RESTORE_TIMEOUT_MS = 10_000;

function withinRestoreTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Session restore timed out")),
      RESTORE_TIMEOUT_MS,
    );
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function restorePersistedSession(showLoading: boolean): Promise<void> {
  if (sessionRestore !== null) return sessionRestore;
  if (showLoading) {
    useSessionStore.setState({ status: "loading", session: null, user: null });
  }

  const revision = authEventRevision;
  const operation = (async () => {
    try {
      const { data, error } = await withinRestoreTimeout(
        supabase.auth.getSession(),
      );
      // Offline with an expired access token, supabase-js keeps the session
      // on disk but answers `null` with a retryable error. Read as "signed
      // out", that put a signed-in user on the sign-in screens until the
      // network came back.
      if (error !== null && isAuthRetryableFetchError(error)) throw error;
      if (data.session !== null && isRecoveryPending()) {
        // The last run died in the middle of a password reset. The session
        // its link opened is good for that reset alone, so it is ended — the
        // teardown publishes the signed-out state — rather than resumed.
        await endRecoverySession().catch(() => undefined);
        return;
      }
      await waitForAccountTeardown();
      if (data.session === null) {
        // Settled before the sign-in screens show, so the unlock that follows
        // a sign-in never offers a fingerprint this install never armed.
        try {
          await retireLegacyBiometricCandidate();
        } catch {
          // Unsettled, the offer stays manual: one tap on an empty slot.
        }
      }
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
  if (event === "SIGNED_OUT") {
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

  if (session === null) {
    useSessionStore.setState(applySession(null));
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
    // The restore below reads the same session and knows what a failure to
    // refresh it means; `INITIAL_SESSION` only carries `null` for both "signed
    // out" and "offline", and would overrule it.
    if (event === "INITIAL_SESSION") return;
    authEventRevision += 1;
    authEventQueue = authEventQueue
      .catch(() => undefined)
      .then(() => applyAuthEvent(event, session));
  });
  void restorePersistedSession(true);

  return () => data.subscription.unsubscribe();
}
