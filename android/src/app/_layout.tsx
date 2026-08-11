import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { fr, registerTranslation } from "react-native-paper-dates";

import { observeSession, useSessionStore } from "@/core/auth/session-store";
import { startSupabaseAutoRefresh } from "@/core/auth/supabase";
import { DeepLinkRouter } from "@/core/linking/deep-link-router";
import { queryClient } from "@/core/query/query-client";
import { ForegroundRefresh } from "@/core/system/foreground-refresh";
import { armPrivacyShield } from "@/core/system/privacy-shield";
import { SystemGateScreen } from "@/core/system/system-gate-screen";
import { pulpeDarkTheme, pulpeLightTheme } from "@/core/ui/theme";
import { bootstrapVault, useVaultStore } from "@/core/vault/vault-store";
import {
  restoreOnboardingDraft,
  useOnboardingStore,
} from "@/features/onboarding/onboarding-store";
import { RecoveryKeyNotice } from "@/ui/recovery-key-notice";

void SplashScreen.preventAutoHideAsync();

// The date picker reads its labels from a global registry, so this has to run
// before any calendar mounts — the app is French whatever the device is set to.
registerTranslation("fr", fr);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const status = useSessionStore((state) => state.status);
  const vaultStatus = useVaultStore((state) => state.status);
  const isOnboarding = useOnboardingStore((state) => state.isFlowActive);
  const [areFontsLoaded, fontError] = useFonts({
    Manrope: require("../../assets/fonts/Manrope.ttf"),
  });

  useEffect(() => observeSession(), []);
  useEffect(() => startSupabaseAutoRefresh(), []);
  useEffect(() => armPrivacyShield(), []);
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
      <PaperProvider
        theme={colorScheme === "dark" ? pulpeDarkTheme : pulpeLightTheme}
      >
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            {/* A run in progress outranks the session gates: the user turns
                authenticated at the registration step and would otherwise be
                pulled out of the flow into the vault setup, four steps early. */}
            <Stack.Protected guard={isOnboarding}>
              <Stack.Screen name="(onboarding)" />
            </Stack.Protected>
            <Stack.Protected
              guard={
                !isOnboarding &&
                status === "authenticated" &&
                vaultStatus === "unlocked"
              }
            >
              <Stack.Screen name="(main)" />
            </Stack.Protected>
            <Stack.Protected
              guard={
                !isOnboarding &&
                status === "authenticated" &&
                (vaultStatus === "setupRequired" || vaultStatus === "locked")
              }
            >
              <Stack.Screen name="(vault)" />
            </Stack.Protected>
            <Stack.Protected
              guard={!isOnboarding && status === "unauthenticated"}
            >
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
          {/* Last, so it covers every route and every dialog above them. */}
          <SystemGateScreen />
        </QueryClientProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
