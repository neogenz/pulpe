import { format } from 'date-fns';

/**
 * Formats a Date to a local datetime string (yyyy-MM-dd'T'HH:mm:ss)
 * without UTC conversion, preserving the user's local date.
 *
 * Use this instead of Date.toISOString() when the calendar date matters
 * (e.g., transaction dates from a datepicker).
 */
export function formatLocalDate(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}
