import * as Notifications from "expo-notifications";

import { translate } from "@/core/i18n/i18n";

import { monthlyReminderDay } from "./monthly-reminder";

/**
 * Stable identifier so re-scheduling replaces the reminder instead of stacking
 * duplicates — this is safe to call on every foreground.
 */
const MONTHLY_REMINDER_ID = "pulpe.reminder.monthly";

const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;

/** Android 13+ needs a runtime grant; below that the permission is implicit. */
export async function isReminderPermissionUndecided(): Promise<boolean> {
  const permissions = await Notifications.getPermissionsAsync();
  return permissions.status === Notifications.PermissionStatus.UNDETERMINED;
}

/**
 * Fires the real OS prompt. Only ever call this from behind the priming sheet:
 * a denial is remembered by the system, so a prompt shown cold costs the
 * feature permanently.
 */
export async function requestReminderPermission(): Promise<boolean> {
  const permissions = await Notifications.requestPermissionsAsync();
  return permissions.granted;
}

/**
 * (Re)schedules the monthly "nouveau mois" reminder on the pay day at 9:00.
 *
 * The copy carries no amount on purpose: the notification fires up to a month
 * after being scheduled, at the *start* of a cycle — last month's figure would
 * be stale by then and the new month is not built yet.
 */
export async function scheduleMonthlyReminder(
  payDayOfMonth: number | null,
): Promise<void> {
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;

  await Notifications.cancelScheduledNotificationAsync(
    MONTHLY_REMINDER_ID,
  ).catch(() => {
    // Nothing was scheduled yet — the point of the call is only to avoid a
    // second copy, so there is nothing to report.
  });

  await Notifications.scheduleNotificationAsync({
    identifier: MONTHLY_REMINDER_ID,
    content: {
      title: translate("settings.preferences.reminderNotificationTitle"),
      body: translate("settings.preferences.reminderNotificationBody"),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: monthlyReminderDay(payDayOfMonth),
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
    },
  });
}

export function cancelMonthlyReminder(): Promise<void> {
  return Notifications.cancelScheduledNotificationAsync(MONTHLY_REMINDER_ID);
}
