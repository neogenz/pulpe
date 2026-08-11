import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { ENV } from "@/core/config/env";

import { chunkedSecureStore } from "./chunked-secure-store";

/**
 * Where the reset e-mail sends the user back. Same URL as iOS and the webapp,
 * on purpose: it is an App Link here, a Universal Link there, and an ordinary
 * page in a browser — one address, whichever surface the user opens it on.
 * It must also be listed in the Supabase project's allowed redirect URLs.
 */
export const PASSWORD_RESET_REDIRECT_URL =
  "https://app.pulpe.app/reset-password";

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
 * Re-authenticates the account holder before a change only they should be able
 * to make — a new password, a fresh recovery key. Signing in again is what
 * Supabase offers to check a password, and it returns the same user, so the
 * session it hands back replaces an equivalent one.
 */
export async function verifyPassword(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
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

/**
 * The one place a global sign-out is correct: the password just changed, or a
 * recovery session is being abandoned. Revoking every refresh token of the
 * account is the point — a password reset that left the old sessions alive
 * would not be a reset. Mirrors `cancelPasswordResetFlow` on iOS.
 */
export async function signOutEverywhere(): Promise<void> {
  await supabase.auth.signOut({ scope: "global" });
}
