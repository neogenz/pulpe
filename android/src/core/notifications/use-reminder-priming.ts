import { useState } from "react";

import { useUserSettings } from "@/core/user-settings/user-settings-queries";

import { readRemindersPrimed, writeRemindersPrimed } from "./reminder-flags";
import {
  isReminderPermissionUndecided,
  requestReminderPermission,
  scheduleMonthlyReminder,
} from "./scheduler";

export interface ReminderPriming {
  isVisible: boolean;
  /**
   * Call at the moment reminders would earn their keep — the first time the
   * user points an operation. Does nothing on a repeat, or once the system
   * permission has been settled either way.
   */
  offer: () => void;
  dismiss: () => void;
  /** Fires the real OS prompt, then arms the reminder if it was granted. */
  enable: () => void;
}

/**
 * Offers the monthly reminder exactly once, and only while the system prompt is
 * still winnable. The flag is written when the sheet is *shown*, not when it is
 * accepted: a user who chose "Plus tard" has answered, and asking again on the
 * next pointing would be nagging.
 */
export function useReminderPriming(): ReminderPriming {
  const settings = useUserSettings();
  const [isVisible, setVisible] = useState(false);

  function offer(): void {
    if (readRemindersPrimed()) return;
    void isReminderPermissionUndecided().then((isUndecided) => {
      if (!isUndecided || readRemindersPrimed()) return;
      writeRemindersPrimed();
      setVisible(true);
    });
  }

  function enable(): void {
    setVisible(false);
    void requestReminderPermission().then((isGranted) => {
      if (!isGranted) return;
      return scheduleMonthlyReminder(settings.data?.payDayOfMonth ?? null);
    });
  }

  return {
    isVisible,
    offer,
    dismiss: () => setVisible(false),
    enable,
  };
}
