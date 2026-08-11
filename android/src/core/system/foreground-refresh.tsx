import { useEffect, useRef } from "react";
import { AppState } from "react-native";

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
 * A component rather than a plain hook: it reads user settings through React
 * Query, whose provider is mounted below the root layout.
 */
export function ForegroundRefresh(): null {
  const settings = useUserSettings();
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;
  // A ref, so a settings refetch does not tear down and re-add the listener.
  const payDayRef = useRef(payDayOfMonth);

  useEffect(() => {
    payDayRef.current = payDayOfMonth;
  });

  useEffect(() => {
    function refresh() {
      void checkSystemGate();
      if (readRemindersEnabled()) {
        void scheduleMonthlyReminder(payDayRef.current);
      }
    }

    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => subscription.remove();
  }, []);

  return null;
}
