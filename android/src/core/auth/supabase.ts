import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { ENV } from "@/core/config/env";

import { chunkedSecureStore } from "./chunked-secure-store";

export const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    storage: chunkedSecureStore,
    persistSession: true,
    autoRefreshToken: true,
    // There is no URL bar to read a session out of; deep links are handled by
    // the auth flow itself.
    detectSessionInUrl: false,
  },
});

/**
 * Supabase refreshes on a timer, which Android suspends in the background. The
 * timer is therefore tied to foreground state, as the supabase-js React Native
 * guide requires.
 */
export function startSupabaseAutoRefresh(): () => void {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  if (AppState.currentState === "active") supabase.auth.startAutoRefresh();

  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}

/**
 * Reads the access token, letting supabase-js refresh it first when it is about
 * to expire. Reading the cached session object instead would occasionally send
 * a token that expired seconds earlier.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Signing out is deliberately scoped to this device. The default `global`
 * scope revokes every refresh token of the account, which would sign the user
 * out of iOS and the webapp at the same time — the webapp already caused that
 * incident once by signing out globally.
 */
export async function signOutThisDevice(): Promise<void> {
  await supabase.auth.signOut({ scope: "local" });
}
