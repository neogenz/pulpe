import type { Session } from "@supabase/supabase-js";

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
const mockInvalidateLanguage = jest.fn();
let mockAuthListener:
  | ((event: string, session: Session | null) => void)
  | null = null;

jest.mock("./supabase", () => ({
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
}));

const session = (id: string) => ({ user: { id } }) as Session;

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
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
    mockClearKeys.mockImplementation(async () => events.push("keys-cleared"));
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

  it("shares one purge between explicit sign-out and SIGNED_OUT", async () => {
    const unsubscribe = observeSession();
    await settle();
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
      "keys-cleared",
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
    expect(mockClearKeys).not.toHaveBeenCalled();
    unsubscribe();
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
    expect(events.at(-1)).toBe("keys-cleared");
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
