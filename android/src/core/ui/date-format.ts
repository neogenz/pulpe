/**
 * Dates are French regardless of the currency, matching `Formatters.swift`,
 * which pins `fr_FR` on every date formatter while the amounts follow the
 * account's currency.
 */
const DATE_LOCALE = "fr-FR";

const monthFormatter = new Intl.DateTimeFormat(DATE_LOCALE, { month: "long" });
const dayMonthFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
  day: "numeric",
  month: "long",
});

/** `juillet` — the month a budget covers, named from its 1-12 index. */
export function formatMonthName(month: number, year: number): string {
  return monthFormatter.format(new Date(year, month - 1, 1));
}

/** `5 juillet`, and `1er juillet` on the one day French does not say "1". */
export function formatDayMonth(date: Date): string {
  if (date.getDate() !== 1) return dayMonthFormatter.format(date);
  return `1er ${monthFormatter.format(date)}`;
}
