import { API_ERROR_CODES } from "pulpe-shared";
import { Stack } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { View } from "react-native";

import RootLayout from "@/app/_layout";
import VaultLayout from "@/app/(vault)/_layout";
import IndexRoute from "@/app/index";
import { ApiError } from "@/core/api/api-error";
import { useSessionStore } from "@/core/auth/session-store";
import { queryClient } from "@/core/query/query-client";
import { lockVault, useVaultStore } from "@/core/vault/vault-store";
import { useOnboardingStore } from "@/features/onboarding/onboarding-store";

/**
 * The real root layout, `index` and `(vault)` layout on the real router. What
 * is observed is where a guard flip lands, which no unit of `landingRoute` can
 * say: react-navigation restarts an emptied stack on `routeNames[0]`, and the
 * route it picks is decided by the layout, not by the decider.
 */
jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("@/core/auth/session-store", () => {
  const { create } = jest.requireActual("zustand");
  return {
    observeSession: jest.fn(() => () => {}),
    useSessionStore: create(() => ({
      status: "authenticated",
      retrySessionRestore: jest.fn(),
      signOut: jest.fn(),
    })),
  };
});
jest.mock("@/core/auth/supabase", () => ({
  startSupabaseAutoRefresh: jest.fn(() => () => {}),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/i18n/locale-sync", () => ({ LocaleSync: () => null }));
jest.mock("@/core/linking/deep-link-router", () => ({
  DeepLinkRouter: () => null,
}));
jest.mock("@/core/observability/analytics", () => ({
  captureException: jest.fn(),
  startAnalytics: jest.fn(() => () => {}),
  useScreenTracking: jest.fn(),
}));
jest.mock("@/core/system/foreground-refresh", () => ({
  ForegroundRefresh: () => null,
}));
jest.mock("@/core/system/privacy-shield", () => ({
  armPrivacyShield: jest.fn(() => () => {}),
}));
jest.mock("@/core/system/system-gate-screen", () => ({
  SystemGateScreen: () => null,
}));
jest.mock("@/core/system/whats-new-sheet", () => ({
  WhatsNewSheet: () => null,
}));
jest.mock("@/core/vault/auto-lock", () => ({
  armAutoLock: jest.fn(() => () => {}),
}));
jest.mock("@/core/vault/vault-api", () => ({
  fetchSalt: jest.fn(),
  fetchVaultStatus: jest.fn(),
  setupRecoveryKey: jest.fn(),
  validateClientKey: jest.fn(),
  recoverVault: jest.fn(),
  regenerateRecoveryKey: jest.fn(),
  changePin: jest.fn(),
  verifyRecoveryKey: jest.fn(),
}));
jest.mock("@/core/crypto/pbkdf2", () => ({ deriveClientKey: jest.fn() }));
jest.mock("@/core/crypto/client-key-manager");
// The root layout bootstraps on sign-in; here the store is driven by hand.
jest.mock("@/core/vault/vault-store", () => ({
  ...jest.requireActual("@/core/vault/vault-store"),
  bootstrapVault: jest.fn(),
}));
jest.mock("@/features/onboarding/onboarding-store", () => {
  const { create } = jest.requireActual("zustand");
  return {
    reconcileOnboardingWithVault: jest.fn(),
    restoreOnboardingDraft: jest.fn(),
    useOnboardingStore: create(() => ({
      isFlowActive: false,
      hasCompletedOnboarding: true,
      hasSeenHandoff: true,
    })),
  };
});
jest.mock("@/ui/recovery-key-notice", () => ({
  RecoveryKeyNotice: () => null,
}));

function GroupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function stub(testID: string) {
  return function Screen() {
    return <View testID={testID} />;
  };
}

const context = {
  _layout: RootLayout,
  index: IndexRoute,
  "(vault)/_layout": VaultLayout,
  "(vault)/vault-unlock": stub("vault-unlock"),
  "(vault)/vault-setup": stub("vault-setup"),
  "(vault)/vault-recover": stub("vault-recover"),
  "(main)/_layout": GroupLayout,
  "(main)/(tabs)/_layout": GroupLayout,
  "(main)/(tabs)/home": stub("home"),
  "(main)/post-onboarding": stub("post-onboarding"),
  "(onboarding)/_layout": GroupLayout,
  "(onboarding)/index": stub("onboarding"),
  "(auth)/_layout": GroupLayout,
  "(auth)/sign-in": stub("sign-in"),
};

// RNTL 14 renders asynchronously, so the router result has to be awaited too.
async function renderUnlockedHome() {
  useVaultStore.setState({ status: "unlocked" });
  await renderRouter(context, { initialUrl: "/home" });
  expect(screen.getByTestId("home")).toBeTruthy();
}

beforeEach(() => {
  queryClient.clear();
  useSessionStore.setState({ status: "authenticated" });
  useOnboardingStore.setState({
    isFlowActive: false,
    hasCompletedOnboarding: true,
    hasSeenHandoff: true,
  });
  useVaultStore.setState({
    status: "unknown",
    isBiometricAvailable: false,
    hasBootstrapError: false,
    pendingRecoveryNotice: null,
  });
});

it("lands on the unlock screen, not the setup one, when the vault locks", async () => {
  await renderUnlockedHome();

  await act(() => lockVault());

  expect(await screen.findByTestId("vault-unlock")).toBeTruthy();
  expect(screen.queryByTestId("vault-setup")).toBeNull();
});

it("relocks onto the unlock screen when the server rejects the key", async () => {
  await renderUnlockedHome();

  await act(async () => {
    await queryClient
      .fetchQuery({
        queryKey: ["budgets"],
        queryFn: () =>
          Promise.reject(
            new ApiError(
              "rejected",
              API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED,
              400,
              undefined,
            ),
          ),
      })
      .catch(() => undefined);
  });

  expect(await screen.findByTestId("vault-unlock")).toBeTruthy();
  expect(screen.queryByTestId("vault-setup")).toBeNull();
});

it("sends a fresh account to setup", async () => {
  useVaultStore.setState({ status: "setupRequired" });

  await renderRouter(context, { initialUrl: "/" });

  expect(await screen.findByTestId("vault-setup")).toBeTruthy();
});

it("comes back to the home once the vault is unlocked again", async () => {
  await renderUnlockedHome();
  await act(() => lockVault());
  expect(await screen.findByTestId("vault-unlock")).toBeTruthy();

  act(() => useVaultStore.setState({ status: "unlocked" }));

  expect(await screen.findByTestId("home")).toBeTruthy();
});
