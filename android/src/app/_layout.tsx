import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";

import { observeSession, useSessionStore } from "@/core/auth/session-store";
import { startSupabaseAutoRefresh } from "@/core/auth/supabase";
import { DeepLinkRouter } from "@/core/linking/deep-link-router";
import { openGroups } from "@/core/navigation/route-gates";
import {
  startAnalytics,
  useScreenTracking,
} from "@/core/observability/analytics";
import { startSentry } from "@/core/observability/sentry";
import { queryClient } from "@/core/query/query-client";
import { ForegroundRefresh } from "@/core/system/foreground-refresh";
import { armPrivacyShield } from "@/core/system/privacy-shield";
import { SystemGateScreen } from "@/core/system/system-gate-screen";
import { WhatsNewSheet } from "@/core/system/whats-new-sheet";
import { pulpeDarkTheme, pulpeLightTheme } from "@/core/ui/theme";
import { observeVaultKeyRejection } from "@/core/vault/key-invalidation";
import { bootstrapVault, useVaultStore } from "@/core/vault/vault-store";
import {
  restoreOnboardingDraft,
  useOnboardingStore,
} from "@/features/onboarding/onboarding-store";
import { RecoveryKeyNotice } from "@/ui/recovery-key-notice";

void SplashScreen.preventAutoHideAsync();
// Before the first render rather than in an effect: a crash on the way up is
// exactly the one worth reporting.
const isSentryArmed = startSentry();

// The date picker reads its labels from a global registry, so this has to run
// before any calendar mounts — the app is French whatever the device is set to.

function RootLayout() {
  const colorScheme = useColorScheme();
  const status = useSessionStore((state) => state.status);
  const vaultStatus = useVaultStore((state) => state.status);
  const isOnboarding = useOnboardingStore((state) => state.isFlowActive);
  const hasCompletedOnboarding = useOnboardingStore(
    (state) => state.hasCompletedOnboarding,
  );
  const hasSeenHandoff = useOnboardingStore((state) => state.hasSeenHandoff);
  const [areFontsLoaded, fontError] = useFonts({
    Manrope: require("../../assets/fonts/Manrope.ttf"),
  });
  const groups = openGroups({
    status,
    vaultStatus,
    isOnboarding,
    hasCompletedOnboarding,
    hasSeenHandoff,
  });

  useEffect(() => observeSession(), []);
  useEffect(() => startSupabaseAutoRefresh(), []);
  useEffect(() => armPrivacyShield(), []);
  useEffect(() => observeVaultKeyRejection(), []);
  useEffect(() => startAnalytics(), []);
  useScreenTracking();
  // Synchronous, and before the first route decision: an unfinished run has to
  // be known by the time the guards below are evaluated.
  useEffect(() => restoreOnboardingDraft(), []);

  // Signing in tells us nothing about the vault — only the server does, and
  // every screen past the gate reads amounts that need it open.
  useEffect(() => {
    if (status !== "authenticated") return;
    void bootstrapVault();
  }, [status]);

  // A font that fails to load must not hold the splash forever: the system
  // font is a perfectly usable fallback, a permanently blank screen is not.
  const isReady =
    (areFontsLoaded || fontError !== null) && status !== "loading";

  useEffect(() => {
    if (isReady) void SplashScreen.hideAsync();
  }, [isReady]);

  // Holding the splash rather than rendering a spinner keeps the first frame
  // from showing a signed-out shell to a user who is in fact signed in.
  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Query above Paper, and not the other way round: a Paper `Portal` is
          not a React portal — it re-renders its children under the `Portal.Host`
          that `PaperProvider` mounts, so they see the context of *that* spot in
          the tree, not of where they were written. With Paper on the outside,
          every sheet calling a query hook threw "No QueryClient set". */}
      <QueryClientProvider client={queryClient}>
        <PaperProvider
          theme={colorScheme === "dark" ? pulpeDarkTheme : pulpeLightTheme}
        >
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            {/* A run in progress outranks the session gates: the user turns
                authenticated at the registration step and would otherwise be
                pulled out of the flow into the vault setup, four steps early.
                Which groups these are, and why, lives in `openGroups`. */}
            <Stack.Protected guard={groups.includes("(onboarding)")}>
              <Stack.Screen name="(onboarding)" />
            </Stack.Protected>
            <Stack.Protected guard={groups.includes("(main)")}>
              <Stack.Screen name="(main)" />
            </Stack.Protected>
            <Stack.Protected guard={groups.includes("(vault)")}>
              <Stack.Screen name="(vault)" />
            </Stack.Protected>
            <Stack.Protected guard={groups.includes("(auth)")}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
          {/* Above the navigator: the key it announces outlives the screen
              that minted it, which unmounts the moment the vault unlocks. */}
          <RecoveryKeyNotice />
          <ForegroundRefresh />
          {/* Inside the navigator: it navigates, so it needs the router
              mounted — and it holds a link until the vault opens one. */}
          <DeepLinkRouter />
          <WhatsNewSheet />
          {/* Last, so it covers every route and every dialog above them. */}
          <SystemGateScreen />
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// `wrap` is what gives Sentry the error boundary and the touch trail that turn
// a stack trace into something reproducible — and it warns on every launch if
// it is applied with no client behind it, which is every development build.
export default isSentryArmed ? Sentry.wrap(RootLayout) : RootLayout;
