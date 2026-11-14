import * as Notifications from "expo-notifications";
import type { SupportedCurrency } from "pulpe-shared";

import { translate } from "@/core/i18n/i18n";
import { areAmountsHidden } from "@/core/ui/amount-visibility";
import type { BudgetDetails } from "@/features/budgets/budget-api";

import { monthlyReminderDay } from "./monthly-reminder";
import {
  makeWeeklyRecap,
  nextRecapDate,
  weeklyRecapBody,
} from "./weekly-recap";

/**
 * Stable identifier so re-scheduling replaces the reminder instead of stacking
 * duplicates — this is safe to call on every foreground.
 */
const MONTHLY_REMINDER_ID = "pulpe.reminder.monthly";

/** One slot per upcoming Monday, so a reschedule replaces all of them. */
const WEEKLY_RECAP_IDS = [0, 1, 2].map(
  (week) => `pulpe.reminder.weekly-recap.${week}`,
);

/** The `reminder` analytics dimension, stable once shipped. */
export type ReminderKind = "monthly" | "weekly_recap";

/** Which reminder a delivered notification is, `null` for anything Pulpe did not schedule. */
export function reminderOfNotification(
  identifier: string,
): ReminderKind | null {
  if (identifier === MONTHLY_REMINDER_ID) return "monthly";
  return WEEKLY_RECAP_IDS.includes(identifier) ? "weekly_recap" : null;
}

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

export interface WeeklyRecapInput {
  details: BudgetDetails;
  payDayOfMonth: number | null;
  currency: SupportedCurrency;
}

/**
 * (Re)schedules the next three Monday recaps, each computed for its own date
 * from the budget held now. Content is frozen at scheduling, which keeps the
 * later two exact only while nothing new is recorded: every fresh snapshot
 * replaces all three, and the series ends when none arrives for three weeks.
 * Amounts and forecast names stay out while the user hides amounts.
 */
export async function scheduleWeeklyRecaps({
  details,
  payDayOfMonth,
  currency,
}: WeeklyRecapInput): Promise<void> {
  const run = ++weeklyRecapRun;
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted || run !== weeklyRecapRun) return;

  await clearWeeklyRecaps();
  const firstMonday = nextRecapDate(new Date());
  for (const [week, identifier] of WEEKLY_RECAP_IDS.entries()) {
    const fireDate = new Date(firstMonday);
    fireDate.setDate(fireDate.getDate() + 7 * week);
    if (run !== weeklyRecapRun) return;
    const recap = makeWeeklyRecap(fireDate, details, payDayOfMonth);
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: translate("settings.preferences.weeklyRecap.notificationTitle"),
        body: weeklyRecapBody(recap, currency, !areAmountsHidden()),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
  }
}

/**
 * A cancellation outdates any scheduling still awaiting the system: without
 * this, a sign-out landing mid-schedule would leave the departing account's
 * amounts armed for the next Mondays.
 */
let weeklyRecapRun = 0;

export function cancelWeeklyRecaps(): Promise<void> {
  weeklyRecapRun += 1;
  return clearWeeklyRecaps();
}

/** Delivered ones too: a recap left in the shade keeps showing its amounts. */
async function clearWeeklyRecaps(): Promise<void> {
  await Promise.all(
    WEEKLY_RECAP_IDS.flatMap((identifier) => [
      Notifications.cancelScheduledNotificationAsync(identifier),
      Notifications.dismissNotificationAsync(identifier),
    ]).map((undo) =>
      undo.catch(() => {
        // Never scheduled or never delivered: nothing to undo.
      }),
    ),
  );
}

/** Identity boundary: every reminder belongs to the account leaving. */
export async function cancelAllReminders(): Promise<void> {
  await cancelWeeklyRecaps();
  await cancelMonthlyReminder();
}
