import { supabase } from "./supabase";

/**
 * The tokens Supabase hands back on a recovery link. The client runs the
 * default `implicit` flow, so they arrive in the URL *fragment* rather than the
 * query string — `#access_token=…&refresh_token=…&type=recovery`. A link that
 * expired or was already used carries `#error=…` instead and yields `null`.
 */
export interface RecoveryTokens {
  accessToken: string;
  refreshToken: string;
}

export function parseRecoveryTokens(url: string): RecoveryTokens | null {
  const fragment = url.split("#")[1];
  if (fragment === undefined) return null;

  const params = new URLSearchParams(fragment);
  if (params.get("type") !== "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

/**
 * Opens the recovery session the link carries. Distinct from an ordinary
 * sign-in: it authenticates the user for exactly one purpose, and the caller
 * ends it either way — see `endRecoverySession`.
 */
export async function beginPasswordRecovery(
  tokens: RecoveryTokens,
): Promise<void> {
  const { error } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
