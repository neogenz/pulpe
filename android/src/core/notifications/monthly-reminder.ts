const FIRST_DAY = 1;

/**
 * Pay day is stored 1–31, but a trigger on the 29th, 30th or 31st silently skips
 * every month that has no such date — a day-31 reminder never fires in February.
 * Clamping to 28 makes the nudge arrive every single month, at worst a couple of
 * days early, which is the right trade for a start-of-cycle reminder.
 */
export const LAST_SAFE_DAY = 28;

/** The month's first day when the account has no pay day set. */
export const DEFAULT_REMINDER_DAY = FIRST_DAY;

export function monthlyReminderDay(payDayOfMonth: number | null): number {
  if (payDayOfMonth === null) return DEFAULT_REMINDER_DAY;
  return Math.min(
    Math.max(Math.trunc(payDayOfMonth), FIRST_DAY),
    LAST_SAFE_DAY,
  );
}
