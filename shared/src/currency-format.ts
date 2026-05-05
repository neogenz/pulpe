import { CURRENCY_METADATA } from './currency.js';
import type { SupportedCurrency } from '../schemas.js';

/**
 * Shared `Intl.NumberFormat` factory for currency display.
 *
 * Lives in `pulpe-shared` (not in webapp's `core/currency/`) so both the
 * `ui/` and `core/` layers can use a single formatter cache without the
 * `ui/` → `core/` dependency crossing forbidden by layer rules.
 *
 * Formatters are memoised by `locale + currency` so that repeated calls
 * for the same pair reuse the same `Intl.NumberFormat` instance.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

/**
 * Returns a cached `Intl.NumberFormat` for the given currency and locale.
 *
 * If `locale` is omitted, the locale from {@link CURRENCY_METADATA} is used.
 * Falls back to `fr-CH` when the currency has no metadata entry.
 */
export function getCurrencyFormatter(
  currency: SupportedCurrency | string,
  locale?: string,
): Intl.NumberFormat {
  const resolvedLocale =
    locale ??
    CURRENCY_METADATA[currency as SupportedCurrency]?.locale ??
    'fr-CH';
  const key = `${resolvedLocale}_${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}
