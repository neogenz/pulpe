import { AuthRetryableFetchError, type Session } from "@supabase/supabase-js";

import {
  endRecoverySession,
  observeSession,
  useSessionStore,
} from "./session-store";

const events: string[] = [];
const mockGetSession = jest.fn();
const mockSignOutThisDevice = jest.fn();
const mockSignOutEverywhere = jest.fn();
const mockUnsubscribe = jest.fn();
const mockQueryClear = jest.fn();
const mockClearLocale = jest.fn();
const mockResetVault = jest.fn();
const mockForgetLanding = jest.fn();
const mockClearKeys = jest.fn();
const mockRetireLegacyBiometric = jest.fn();
const mockInvalidateLanguage = jest.fn();
const mockCancelReminder = jest.fn();
const mockWriteRemindersEnabled = jest.fn();
const mockForgetGoogle = jest.fn();
const mockForgetPersistedSession = jest.fn();
const mockHasPersistedSession = jest.fn();
const mockIsRecoveryPending = jest.fn();
const mockClearRecoveryPending = jest.fn();
let mockAuthListener:
  | ((event: string, session: Session | null) => void)
  | null = null;

jest.mock("./password-recovery", () => ({
  clearRecoveryPending: () => mockClearRecoveryPending(),
  isRecoveryPending: () => mockIsRecoveryPending(),
}));
jest.mock("./google-sign-in", () => ({
  forgetGoogleAccount: () => mockForgetGoogle(),
}));
jest.mock("./supabase", () => ({
  forgetPersistedSession: () => mockForgetPersistedSession(),
  hasPersistedSession: () => mockHasPersistedSession(),
  signOutThisDevice: () => mockSignOutThisDevice(),
  signOutEverywhere: () => mockSignOutEverywhere(),
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: jest.fn((listener) => {
        mockAuthListener = listener;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }),
    },
  },
}));
jest.mock("@/core/query/query-client", () => ({
  queryClient: { clear: () => mockQueryClear() },
}));
jest.mock("@/core/i18n/locale-store", () => ({
  clearLocaleSnapshot: () => mockClearLocale(),
}));
jest.mock("@/core/i18n/language-writer", () => ({
  languageWriter: { invalidate: () => mockInvalidateLanguage() },
}));
jest.mock("@/core/vault/vault-store", () => ({
  resetVault: () => mockResetVault(),
}));
jest.mock("@/core/navigation/landing-preference", () => ({
  forgetLandingPreference: () => mockForgetLanding(),
}));
jest.mock("@/core/crypto/client-key-manager", () => ({
  clearAllKeys: () => mockClearKeys(),
  retireLegacyBiometricCandidate: () => mockRetireLegacyBiometric(),
}));
jest.mock("@/core/notifications/scheduler", () => ({
  cancelMonthlyReminder: () => mockCancelReminder(),
}));
jest.mock("@/core/notifications/reminder-flags", () => ({
  writeRemindersEnabled: (isEnabled: boolean) =>
    mockWriteRemindersEnabled(isEnabled),
}));

const session = (id: string) => ({ user: { id } }) as Session;

async function settle(): Promise<void> {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("session lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    events.length = 0;
    mockAuthListener = null;
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignOutThisDevice.mockImplementation(async () => {
      events.push("signed-out");
    });
    mockSignOutEverywhere.mockImplementation(async () => {
      events.push("sessions-revoked");
    });
    mockInvalidateLanguage.mockImplementation(() =>
      events.push("language-invalidated"),
    );
    mockQueryClear.mockImplementation(() => events.push("cache-cleared"));
    mockClearLocale.mockImplementation(() => events.push("locale-reset"));
    mockResetVault.mockImplementation(() => events.push("vault-reset"));
    mockForgetLanding.mockImplementation(() => events.push("landing-reset"));
    mockCancelReminder.mockImplementation(async () =>
      events.push("reminder-cancelled"),
    );
    mockWriteRemindersEnabled.mockImplementation((isEnabled: boolean) =>
      events.push(`reminders-enabled:${String(isEnabled)}`),
    );
    mockClearKeys.mockImplementation(async () => events.push("keys-cleared"));
    mockRetireLegacyBiometric.mockImplementation(async () =>
      events.push("legacy-biometric-retired"),
    );
    mockForgetGoogle.mockImplementation(async () =>
      events.push("google-forgotten"),
    );
    mockHasPersistedSession.mockResolvedValue(false);
    mockIsRecoveryPending.mockReturnValue(false);
    useSessionStore.setState({
      status: "authenticated",
      session: session("user-a"),
      user: session("user-a").user,
    });
  });

  it("exposes a recoverable error and retries session restore single-flight", async () => {
    const restored = session("restored-user");
    mockGetSession
      .mockRejectedValueOnce(new Error("secure storage unavailable"))
      .mockResolvedValueOnce({ data: { session: restored } });

    const unsubscribe = observeSession();
    await settle();
    expect(useSessionStore.getState().status).toBe("error");

    const first = useSessionStore.getState().retrySessionRestore();
    const second = useSessionStore.getState().retrySessionRestore();
    expect(first).toBe(second);
    await Promise.all([first, second]);

    expect(mockGetSession).toHaveBeenCalledTimes(2);
    expect(useSessionStore.getState()).toMatchObject({
      status: "authenticated",
      session: restored,
      user: restored.user,
    });
    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  /**
   * Offline with an expired access token, supabase-js keeps the session on
   * disk and answers `null` with a retryable error, then emits
   * `INITIAL_SESSION` with `null`. Both read as "signed out" put a signed-in
   * user on the sign-in screens until the network came back.
   */
  it("offers a retry instead of signing out when the restore is offline", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: new AuthRetryableFetchError("Failed to fetch", 0),
    });

    const unsubscribe = observeSession();
    mockAuthListener?.("INITIAL_SESSION", null);
    await settle();

    expect(useSessionStore.getState().status).toBe("error");
    expect(mockClearKeys).not.toHaveBeenCalled();
    expect(mockRetireLegacyBiometric).not.toHaveBeenCalled();
    unsubscribe();
  });

  /**
   * A fresh install has no biometric marker, which also describes an older
   * release that only wrote the authenticated slot. Only the second can be
   * launched signed in; the first offered an unlock that read nothing.
   */
  it("retires the legacy fingerprint offer before a signed-out launch shows", async () => {
    const unsubscribe = observeSession();
    await settle();

    expect(useSessionStore.getState().status).toBe("unauthenticated");
    expect(events).toEqual(["legacy-biometric-retired"]);
    unsubscribe();
  });

  it("keeps the legacy offer for a launch that restores a session", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: session("upgraded-user") },
    });

    const unsubscribe = observeSession();
    await settle();

    expect(useSessionStore.getState().status).toBe("authenticated");
    expect(mockRetireLegacyBiometric).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("still reaches the sign-in screens when the marker cannot be written", async () => {
    mockRetireLegacyBiometric.mockRejectedValueOnce(new Error("store failed"));

    const unsubscribe = observeSession();
    await settle();

    expect(useSessionStore.getState().status).toBe("unauthenticated");
    unsubscribe();
  });

  it("ends a password reset the last run died in instead of resuming it", async () => {
    // Supabase persists a recovery session like any other; restored as is,
    // it signed the user in past the password the reset was there to replace.
    mockGetSession.mockResolvedValueOnce({
      data: { session: session("recovering-user") },
    });
    mockIsRecoveryPending.mockReturnValue(true);
    useSessionStore.setState({ status: "loading", session: null, user: null });

    const unsubscribe = observeSession();
    await settle();

    expect(mockSignOutEverywhere).toHaveBeenCalledTimes(1);
    expect(mockClearRecoveryPending).toHaveBeenCalled();
    expect(useSessionStore.getState()).toMatchObject({
      status: "unauthenticated",
      session: null,
    });
    unsubscribe();
  });

  it("does not resume a dead reset even when its session cannot be removed", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: session("recovering-user") },
    });
    mockIsRecoveryPending.mockReturnValue(true);
    mockHasPersistedSession.mockResolvedValue(true);
    useSessionStore.setState({ status: "loading", session: null, user: null });

    const unsubscribe = observeSession();
    await settle();

    expect(useSessionStore.getState().status).toBe("unauthenticated");
    unsubscribe();
  });

  it("stops holding the splash when a restore hangs, and still signs in later", async () => {
    jest.useFakeTimers();
    try {
      const restored = session("late-user");
      mockGetSession.mockReturnValueOnce(new Promise(() => undefined));
      useSessionStore.setState({
        status: "loading",
        session: null,
        user: null,
      });

      const unsubscribe = observeSession();
      await jest.advanceTimersByTimeAsync(10_000);
      expect(useSessionStore.getState().status).toBe("error");

      // The refresh supabase-js kept retrying lands after all.
      mockAuthListener?.("TOKEN_REFRESHED", restored);
      await jest.advanceTimersByTimeAsync(0);
      expect(useSessionStore.getState()).toMatchObject({
        status: "authenticated",
        session: restored,
      });
      unsubscribe();
    } finally {
      jest.useRealTimers();
    }
  });

  it("shares one purge between explicit sign-out and SIGNED_OUT", async () => {
    const unsubscribe = observeSession();
    await settle();
    events.length = 0;
    useSessionStore.setState({
      status: "authenticated",
      session: session("user-a"),
      user: session("user-a").user,
    });
    mockSignOutThisDevice.mockImplementationOnce(async () => {
      events.push("signed-out");
      mockAuthListener?.("SIGNED_OUT", null);
    });

    await useSessionStore.getState().signOut();
    await settle();

    expect(events).toEqual([
      "signed-out",
      "language-invalidated",
      "cache-cleared",
      "locale-reset",
      "vault-reset",
      "landing-reset",
      "reminder-cancelled",
      "reminders-enabled:false",
      "keys-cleared",
      "google-forgotten",
    ]);
    expect(mockSignOutThisDevice).toHaveBeenCalledTimes(1);
    expect(mockQueryClear).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().status).toBe("unauthenticated");
    unsubscribe();
  });

  it("keeps local preferences for an initial signed-out session", async () => {
    const unsubscribe = observeSession();
    mockAuthListener?.("INITIAL_SESSION", null);
    await settle();

    expect(useSessionStore.getState().status).toBe("unauthenticated");
    expect(mockQueryClear).not.toHaveBeenCalled();
    expect(mockClearLocale).not.toHaveBeenCalled();
    expect(mockResetVault).not.toHaveBeenCalled();
    expect(mockForgetLanding).not.toHaveBeenCalled();
    expect(mockCancelReminder).not.toHaveBeenCalled();
    expect(mockWriteRemindersEnabled).not.toHaveBeenCalled();
    expect(mockClearKeys).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("signs out cleanly when there was no reminder to cancel", async () => {
    useSessionStore.setState({
      status: "authenticated",
      session: session("user-a"),
      user: session("user-a").user,
    });
    mockCancelReminder.mockRejectedValueOnce(new Error("not scheduled"));

    await expect(useSessionStore.getState().signOut()).resolves.toBeUndefined();

    expect(mockWriteRemindersEnabled).toHaveBeenCalledWith(false);
    expect(mockClearKeys).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe("unauthenticated");
  });

  it("waits for account A cleanup before applying session B", async () => {
    const keys = deferred();
    mockClearKeys.mockImplementationOnce(async () => {
      events.push("keys-started");
      await keys.promise;
      events.push("keys-cleared");
    });
    const unsubscribe = observeSession();
    await settle();
    useSessionStore.setState({
      status: "authenticated",
      session: session("user-a"),
      user: session("user-a").user,
    });

    mockAuthListener?.("SIGNED_OUT", null);
    await settle();
    const nextSession = session("user-b");
    mockAuthListener?.("SIGNED_IN", nextSession);
    await settle();

    expect(useSessionStore.getState().user?.id).toBe("user-a");
    keys.resolve();
    await settle();

    expect(useSessionStore.getState()).toMatchObject({
      status: "authenticated",
      session: nextSession,
      user: nextSession.user,
    });
    expect(mockQueryClear).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toBe("google-forgotten");
    unsubscribe();
  });

  it("purges a recovery session even when global revocation fails", async () => {
    const revocationError = new Error("revocation failed");
    mockSignOutEverywhere.mockRejectedValueOnce(revocationError);

    await expect(endRecoverySession()).resolves.toEqual({
      providerError: revocationError,
    });

    expect(mockSignOutThisDevice).toHaveBeenCalledTimes(1);
    expect(mockQueryClear).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().status).toBe("unauthenticated");
  });

  it("drops the session supabase-js kept when signing out offline", async () => {
    // With an expired access token and no network, supabase-js cannot load
    // the session to drop and leaves it on disk: the next launch online
    // signed the user straight back in.
    let isPersisted = true;
    const offline = new AuthRetryableFetchError("Failed to fetch", 0);
    mockSignOutThisDevice.mockRejectedValue(offline);
    mockHasPersistedSession.mockImplementation(async () => isPersisted);
    mockForgetPersistedSession.mockImplementation(async () => {
      isPersisted = false;
    });

    await expect(useSessionStore.getState().signOut()).rejects.toBe(offline);

    expect(isPersisted).toBe(false);
    expect(mockClearKeys).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe("unauthenticated");
  });

  it("reports a persisted session it could not remove", async () => {
    mockHasPersistedSession.mockResolvedValue(true);

    await expect(useSessionStore.getState().signOut()).rejects.toThrow(
      "could not be removed",
    );

    expect(mockForgetPersistedSession).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe("unauthenticated");
  });

  it("attempts every cleanup and retains the provider error", async () => {
    const providerError = new Error("provider failed");
    mockSignOutThisDevice.mockRejectedValueOnce(providerError);
    mockClearKeys.mockRejectedValueOnce(new Error("key failed"));

    await expect(useSessionStore.getState().signOut()).rejects.toBe(
      providerError,
    );

    expect(mockQueryClear).toHaveBeenCalled();
    expect(mockResetVault).toHaveBeenCalled();
    expect(mockForgetLanding).toHaveBeenCalled();
    expect(mockClearKeys).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe("unauthenticated");
  });
});
