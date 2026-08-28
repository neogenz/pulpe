import type { Session } from "@supabase/supabase-js";

import { landingRoute } from "@/core/navigation/route-gates";
import { bootstrapVault, useVaultStore } from "@/core/vault/vault-store";

import { observeSession, useSessionStore } from "./session-store";

const restoredSession = { user: { id: "restored-user" } } as Session;
const mockGetSession = jest
  .fn()
  .mockResolvedValueOnce({ data: { session: restoredSession } })
  .mockResolvedValue({ data: { session: null } });

jest.mock("./supabase", () => ({
  signOutThisDevice: jest.fn(),
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
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
