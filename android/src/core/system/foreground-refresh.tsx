import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useSessionStore } from "@/core/auth/session-store";
import { readRemindersEnabled } from "@/core/notifications/reminder-flags";
import { scheduleMonthlyReminder } from "@/core/notifications/scheduler";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";

import { checkSystemGate } from "./system-store";

/**
 * The two things that have to be true every time the app comes back, not just
 * at launch: the build is still supported, and the monthly reminder is still
 * armed.
 *
 * Re-arming matters because Android drops scheduled notifications on a reboot,
 * a force-stop or a backup restore, and nothing tells the app it happened.
 * Scheduling is idempotent — one stable identifier, replaced rather than
 * stacked — so re-asserting it on every foreground is the cheapest way to be
 * sure it survived.
 *
 * Only for a signed-in account whose pay day is known. This component is
 * mounted for every session state, and re-arming signed out — with the pay day
 * the purge had just cleared — brought back, on the 1st, the reminder sign-out
 * had cancelled.
 *
 * A component rather than a plain hook: it reads user settings through React
 * Query, whose provider is mounted below the root layout.
 */
export function ForegroundRefresh(): null {
  const settings = useUserSettings();
  const isSignedIn = useSessionStore(
    (state) => state.status === "authenticated",
  );
  // `undefined` while there is no reminder to re-arm: signed out, or before
  // the settings that name the pay day have loaded (they wait for the vault).
  const reminderDay =
    isSignedIn && settings.data !== undefined
      ? (settings.data.payDayOfMonth ?? null)
      : undefined;
  // A ref, so a settings refetch does not tear down and re-add the listener.
  const reminderDayRef = useRef(reminderDay);

  useEffect(() => {
    reminderDayRef.current = reminderDay;
  });

  useEffect(() => {
    void checkSystemGate();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void checkSystemGate();
      rearmReminder(reminderDayRef.current);
    });

    return () => subscription.remove();
  }, []);

  // Launch, and the moment the day becomes known: after a reboot the first
  // chance to re-arm is the first unlock, not the next foreground.
  useEffect(() => {
    rearmReminder(reminderDay);
  }, [reminderDay]);

  return null;
}

function rearmReminder(payDayOfMonth: number | null | undefined): void {
  if (payDayOfMonth === undefined || !readRemindersEnabled()) return;
  void scheduleMonthlyReminder(payDayOfMonth);
}
