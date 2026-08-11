/**
 * Dates are French regardless of the currency, matching `Formatters.swift`,
 * which pins `fr_FR` on every date formatter while the amounts follow the
 * account's currency.
 */
const DATE_LOCALE = "fr-FR";
const MILLISECONDS_PER_DAY = 86_400_000;

const monthFormatter = new Intl.DateTimeFormat(DATE_LOCALE, { month: "long" });
const dayMonthFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
  day: "numeric",
  month: "long",
});
const fullDateFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** `juillet` — the month a budget covers, named from its 1-12 index. */
export function formatMonthName(month: number, year: number): string {
  return monthFormatter.format(new Date(year, month - 1, 1));
}

/**
 * `Août 2026` — the month where it opens a line, year included. `Intl` hands
 * the name back lowercase, which reads as a typo at the start of a label.
 */
export function formatMonthLabel(month: number, year: number): string {
  const name = formatMonthName(month, year);
  return `${name.slice(0, 1).toLocaleUpperCase(DATE_LOCALE)}${name.slice(1)} ${year}`;
}

/** `5 juillet`, and `1er juillet` on the one day French does not say "1". */
export function formatDayMonth(date: Date): string {
  if (date.getDate() !== 1) return dayMonthFormatter.format(date);
  return `1er ${monthFormatter.format(date)}`;
}

/**
 * `aujourd'hui` and `hier` where they apply, the date otherwise. Reference day
 * is a parameter so a caller that already has "now" does not create a second
 * one — and so the behaviour can be asserted on a fixed day.
 */
export function formatRelativeDay(date: Date, now: Date): string {
  const days = countDaysBetween(startOfDay(date), startOfDay(now));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return formatDayMonth(date);
}

/**
 * `30 nov. 2026` from a bare `YYYY-MM-DD`. Parsed field by field on purpose:
 * `new Date("2026-11-30")` is UTC midnight, which prints as the 29th anywhere
 * west of Greenwich.
 */
export function formatIsoDate(iso: string): string {
  return fullDateFormatter.format(parseIsoDate(iso));
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** The inverse, for a date the user picked with a calendar. */
export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function countDaysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
