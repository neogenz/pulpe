import { createMMKV } from "react-native-mmkv";

import { getPersistedSessionSnapshot, supabase } from "./supabase";

const storage = createMMKV({ id: "pulpe-auth" });

/**
 * Set from just before the recovery session exists until the account is torn
 * down. Supabase persists that session like any other, so a process killed
 * mid-flow relaunched into it as an ordinary sign-in — past the very password
 * the flow was there to replace.
 */
const RECOVERY_PENDING_KEY = "pulpe-recovery-pending";

export function isRecoveryPending(): boolean {
  return storage.getBoolean(RECOVERY_PENDING_KEY) === true;
}

export function clearRecoveryPending(): void {
  storage.remove(RECOVERY_PENDING_KEY);
}

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
  const previousSession = await getPersistedSessionSnapshot();
  const wasRecoveryPending = isRecoveryPending();
  storage.set(RECOVERY_PENDING_KEY, true);
  const { error } = await supabase.auth
    .setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })
    .catch(async (failure: unknown) => {
      try {
        // A storage or listener failure can happen after the session is saved.
        // Keep its guard if storage changed or cannot be read; otherwise a
        // failed attempt must not mark an older or future ordinary sign-in.
        const currentSession = await getPersistedSessionSnapshot();
        if (currentSession === previousSession && !wasRecoveryPending) {
          clearRecoveryPending();
        }
      } catch {
        // An unreadable session may still exist; leave its guard armed.
      }
      throw failure;
    });
  if (error) {
    // Supabase's returned auth rejection did not persist a recovery session.
    if (!wasRecoveryPending) clearRecoveryPending();
    throw error;
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
