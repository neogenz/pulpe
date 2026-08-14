import { CURRENCY_METADATA, type SupportedCurrency } from "pulpe-shared";

import { areAmountsHidden } from "./amount-visibility";

/**
 * What every amount reads as while the user has them hidden. Applied here
 * rather than at the call sites: there are thirty of them, and one that forgot
 * would be the only one leaking a salary over someone's shoulder.
 */
const MASK = "•••";

/**
 * Swiss grouping is the typographic apostrophe. Forced rather than trusted to
 * the runtime: Android ships its own ICU, older builds group `de-CH` with an
 * ASCII quote or a space, and a wrong separator is a wrong-looking amount on
 * every screen.
 *
 * This is why the numbers are formatted here rather than through
 * `getCurrencyFormatter` — it appends the symbol itself, leaving nothing to
 * normalize but a string that already contains a space of its own.
 */
const SWISS_GROUPING_SEPARATOR = "’";
/** ASCII quote plus every space ICU has been seen to group with. */
const FOREIGN_GROUPING_SEPARATORS = /['\u0020\u00A0\u202F\u2009]/g;

const FULL_DIGITS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const WHOLE_DIGITS = { minimumFractionDigits: 0, maximumFractionDigits: 0 };

const formatters = new Map<string, Intl.NumberFormat>();

/** `1’234.56 CHF` — the full amount, decimals included. */
export function formatCurrency(
  value: number,
  currency: SupportedCurrency,
): string {
  if (areAmountsHidden()) return MASK;
  return withSymbol(format(value, currency, FULL_DIGITS), currency);
}

/**
 * `1’235 CHF` — rounded to the unit. What the hero and the cards print: the
 * centimes belong to the budget detail, where a line is being edited.
 */
export function formatCompactCurrency(
  value: number,
  currency: SupportedCurrency,
): string {
  if (areAmountsHidden()) return MASK;
  return withSymbol(format(value, currency, WHOLE_DIGITS), currency);
}

/**
 * `1’234.56` — decimals included, for a hero that sets its symbol apart. The
 * budget detail is where the centimes matter: rounded to the unit, forty
 * centimes of headroom printed as `+0`, a hero announcing a sign and then
 * nothing to put after it. Mirrors `asAmount(for:)` on iOS, which is what that
 * screen has always used.
 */
export function formatAmount(
  value: number,
  currency: SupportedCurrency,
): string {
  if (areAmountsHidden()) return MASK;
  return format(value, currency, FULL_DIGITS);
}

/** `1’235` — rounded to the unit, for a hero that sets its symbol apart. */
export function formatCompactAmount(
  value: number,
  currency: SupportedCurrency,
): string {
  if (areAmountsHidden()) return MASK;
  return format(value, currency, WHOLE_DIGITS);
}

/**
 * Carries a `+` only when the value is positive — a negative one already reads
 * as one, and a `+` on money you simply have would read as a variation.
 */
export function formatSignedCompactCurrency(
  value: number,
  currency: SupportedCurrency,
): string {
  // No sign while masked: `+•••` still says the month went up.
  if (areAmountsHidden()) return MASK;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCompactCurrency(value, currency)}`;
}

/**
 * The same `+`, over the full amount. The budget detail's carry-over line, where
 * a rounded one reads as a report of nothing — `asArithmeticSignedCurrency` on
 * iOS.
 */
export function formatSignedCurrency(
  value: number,
  currency: SupportedCurrency,
): string {
  if (areAmountsHidden()) return MASK;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value, currency)}`;
}

function format(
  value: number,
  currency: SupportedCurrency,
  digits: Intl.NumberFormatOptions,
): string {
  const formatted = formatterFor(currency, digits).format(value);
  return currency === "CHF"
    ? formatted.replace(FOREIGN_GROUPING_SEPARATORS, SWISS_GROUPING_SEPARATOR)
    : formatted;
}

function withSymbol(amount: string, currency: SupportedCurrency): string {
  return `${amount} ${CURRENCY_METADATA[currency].symbol}`;
}

function formatterFor(
  currency: SupportedCurrency,
  digits: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${currency}_${digits.maximumFractionDigits}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(
      CURRENCY_METADATA[currency].numberLocale,
      digits,
    );
    formatters.set(key, formatter);
  }
  return formatter;
}
