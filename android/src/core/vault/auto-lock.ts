import { AppState } from "react-native";

import { lockVault, useVaultStore } from "./vault-store";

/**
 * How long the app may sit in the background before the vault closes behind it.
 *
 * Not zero: signing in with Google, picking a date, answering a notification
 * and taking a call all background the app for a few seconds, and a PIN prompt
 * after each of them would make the one-tap pointing habit unusable. Not an
 * hour either — the vault exists so that a phone left on a table stops being a
 * salary on a table. Five minutes is the window banking apps settle on.
 */
export const AUTO_LOCK_DELAY_MINUTES = 5;
export const AUTO_LOCK_DELAY_MS = AUTO_LOCK_DELAY_MINUTES * 60_000;

/**
 * Whether a return to the foreground has to go back through the PIN.
 *
 * `backgroundedAt` is null on the first foreground of a launch, which is not a
 * return at all: the vault is either still `unknown` or was just opened by the
 * unlock screen.
 */
export function shouldLockOnResume(
  backgroundedAt: number | null,
  now: number,
): boolean {
  return backgroundedAt !== null && now - backgroundedAt >= AUTO_LOCK_DELAY_MS;
}

/**
 * Closes the vault when the app has been away long enough.
 *
 * Nothing here navigates. `lockVault` flips the status, which closes the
 * `(main)` group; the router falls back to `/`, the one route no guard can
 * remove, and `landingRoute` sends it on to the unlock screen. That is the same
 * path a key rejection already takes — see `key-invalidation.ts`.
 */
export function armAutoLock(): () => void {
  let backgroundedAt: number | null = null;

  const subscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") {
      // Only the first departure counts: Android emits `inactive` on the way
      // to `background`, and the second would restart the clock.
      backgroundedAt ??= Date.now();
      return;
    }

    const wasAway = backgroundedAt;
    backgroundedAt = null;

    if (!shouldLockOnResume(wasAway, Date.now())) return;
    if (useVaultStore.getState().status !== "unlocked") return;

    void lockVault();
  });

  return () => subscription.remove();
}
