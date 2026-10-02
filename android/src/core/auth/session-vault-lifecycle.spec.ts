import type { Session } from "@supabase/supabase-js";

import { landingRoute } from "@/core/navigation/route-gates";
import { bootstrapVault, useVaultStore } from "@/core/vault/vault-store";

import {
  beginPasswordRecovery,
  clearRecoveryPending,
} from "./password-recovery";
import { observeSession, useSessionStore } from "./session-store";

const restoredSession = { user: { id: "restored-user" } } as Session;
const mockGetSession = jest
  .fn()
  .mockResolvedValueOnce({ data: { session: restoredSession } })
  .mockResolvedValue({ data: { session: null } });
const mockSetSession = jest.fn();
const mockSignOutEverywhere = jest.fn();

jest.mock("./google-sign-in", () => ({ forgetGoogleAccount: jest.fn() }));
jest.mock("./supabase", () => ({
  getPersistedSessionSnapshot: jest.fn(async () => null),
  hasPersistedSession: jest.fn(async () => false),
  signOutThisDevice: jest.fn(),
  signOutEverywhere: () => mockSignOutEverywhere(),
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      setSession: (...args: unknown[]) => mockSetSession(...args),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}));
jest.mock("@/core/vault/vault-api", () => ({
  fetchVaultStatus: jest.fn(async () => ({ pinCodeConfigured: true })),
}));
jest.mock("@/core/crypto/client-key-manager", () => ({
  clearAllKeys: jest.fn(),
  clearLegacyClientKey: jest.fn(),
  hasBiometricKey: jest.fn(async () => false),
  hasLegacyBiometricKeyCandidate: jest.fn(async () => false),
  disableBiometricUnlock: jest.fn(),
}));
jest.mock("@/core/crypto/pbkdf2", () => ({ deriveClientKey: jest.fn() }));
jest.mock("@/core/query/query-client", () => ({
  queryClient: { clear: jest.fn() },
}));
jest.mock("@/core/i18n/locale-store", () => ({
  clearLocaleSnapshot: jest.fn(),
}));
jest.mock("@/core/i18n/language-writer", () => ({
  languageWriter: { invalidate: jest.fn() },
}));
jest.mock("@/core/navigation/landing-preference", () => ({
  forgetLandingPreference: jest.fn(),
}));
// Sign-out cancels the monthly reminder; expo-notifications refuses to load
// outside a development build.
jest.mock("@/core/notifications/scheduler", () => ({
  cancelMonthlyReminder: jest.fn(async () => undefined),
}));
// Purging the account also turns the reminder flag off; named here rather than
// left to the global MMKV stand-in, as the other session specs do.
jest.mock("@/core/notifications/reminder-flags", () => ({
  writeRemindersEnabled: jest.fn(),
}));

const currentRoute = () =>
  landingRoute({
    status: useSessionStore.getState().status,
    vaultStatus: useVaultStore.getState().status,
    isOnboarding: false,
    hasCompletedOnboarding: true,
    hasSeenHandoff: true,
    prefersSignIn: null,
  });

it("restores into the locked vault and signs out into authentication", async () => {
  const unsubscribe = observeSession();
  await useSessionStore.getState().retrySessionRestore();
  await bootstrapVault();

  expect(currentRoute()).toBe("/vault-unlock");

  await useSessionStore.getState().signOut();

  expect(useVaultStore.getState().status).toBe("unknown");
  expect(currentRoute()).toBe("/sign-in");
  unsubscribe();
});

it("restores an ordinary sign-in after a recovery link was refused", async () => {
  clearRecoveryPending();
  const error = new Error("Invalid refresh token");
  mockSetSession.mockResolvedValueOnce({ error });

  await expect(
    beginPasswordRecovery({ accessToken: "expired", refreshToken: "used" }),
  ).rejects.toBe(error);

  // The user signs in normally and restarts. This session must not be revoked
  // globally as though it belonged to the failed password-reset attempt.
  mockGetSession.mockResolvedValueOnce({
    data: { session: restoredSession },
    error: null,
  });
  useSessionStore.setState({ status: "loading", session: null, user: null });
  const unsubscribe = observeSession();
  try {
    await useSessionStore.getState().retrySessionRestore();

    expect(useSessionStore.getState()).toMatchObject({
      status: "authenticated",
      session: restoredSession,
    });
    expect(mockSignOutEverywhere).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
    clearRecoveryPending();
  }
});
