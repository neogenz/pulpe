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
import { queryClient } from "@/core/query/query-client";
import { pulpeDarkTheme, pulpeLightTheme } from "@/core/ui/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const status = useSessionStore((state) => state.status);
  const [areFontsLoaded, fontError] = useFonts({
    Manrope: require("../../assets/fonts/Manrope.ttf"),
  });

  useEffect(() => observeSession(), []);
  useEffect(() => startSupabaseAutoRefresh(), []);

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
            <Stack.Protected guard={status === "authenticated"}>
              <Stack.Screen name="(main)" />
            </Stack.Protected>
            <Stack.Protected guard={status === "unauthenticated"}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
        </QueryClientProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
