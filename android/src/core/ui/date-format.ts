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
const monthYearShortFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
  month: "short",
  year: "numeric",
});

/** `juillet` — the month a budget covers, named from its 1-12 index. */
export function formatMonthName(
  month: number,
  year: number,
  locale: string = DATE_LOCALE,
): string {
  const formatter =
    locale === DATE_LOCALE
      ? monthFormatter
      : new Intl.DateTimeFormat(locale, { month: "long" });
  return formatter.format(new Date(year, month - 1, 1));
}

/**
 * `Août 2026` — the month where it opens a line, year included. `Intl` hands
 * the name back lowercase, which reads as a typo at the start of a label.
 */
export function formatMonthLabel(
  month: number,
  year: number,
  locale: string = DATE_LOCALE,
): string {
  const name = formatMonthName(month, year, locale);
  return `${name.slice(0, 1).toLocaleUpperCase(locale)}${name.slice(1)} ${year}`;
}

/**
 * `de janvier`, but `d'octobre` — French elides the article before a vowel, and
 * three of the twelve months start with one. Written out because a label that
 * says "Report de octobre" reads as machine output, which is the one thing the
 * copy is not allowed to read as.
 */
export function ofMonth(monthName: string): string {
  return /^[aeiouâàéèêîôû]/i.test(monthName)
    ? `d'${monthName}`
    : `de ${monthName}`;
}

/**
 * `janv. 2026`, and `août 2026` — a chart axis, where the full name would not
 * fit. French abbreviates seven of the twelve months and leaves the short ones
 * whole, which no rule about a fixed number of letters reproduces: cutting to
 * four and adding a period gives "déce.", "octo." and "mars.".
 */
export function formatMonthYearShort(month: number, year: number): string {
  return monthYearShortFormatter.format(new Date(year, month - 1, 1));
}

/** `5 juillet`, and `1er juillet` on the one day French does not say "1". */
export function formatDayMonth(
  date: Date,
  locale: string = DATE_LOCALE,
): string {
  const formatter =
    locale === DATE_LOCALE
      ? dayMonthFormatter
      : new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  if (date.getDate() !== 1 || !locale.toLowerCase().startsWith("fr")) {
    return formatter.format(date);
  }
  const month =
    locale === DATE_LOCALE
      ? monthFormatter.format(date)
      : new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  return `1er ${month}`;
}

/**
 * `aujourd'hui` and `hier` where they apply, the date otherwise. Reference day
 * is a parameter so a caller that already has "now" does not create a second
 * one — and so the behaviour can be asserted on a fixed day.
 */
export function formatRelativeDay(
  date: Date,
  now: Date,
  locale: string = DATE_LOCALE,
): string {
  const days = countDaysBetween(startOfDay(date), startOfDay(now));
  if (days === 0 || days === 1) {
    // Keep the established French apostrophe byte-for-byte for persisted
    // snapshots and tests; Intl uses a typographic apostrophe instead.
    if (locale.toLowerCase().startsWith("fr")) {
      return days === 0 ? "aujourd'hui" : "hier";
    }
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -days,
      "day",
    );
  }
  return formatDayMonth(date, locale);
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
