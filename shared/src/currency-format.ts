import { CURRENCY_METADATA } from './currency.js';
import type { SupportedCurrency } from '../schemas.js';

/**
 * Formats a currency amount as `<number> <symbol>` (symbol in suffix position) —
 * `1’234.56 CHF` / `1 234,56 €`.
 *
 * Lives in `pulpe-shared` (not in webapp's `core/currency/`) so both the `ui/`
 * and `core/` layers can use a single formatter cache without the `ui/` → `core/`
 * dependency crossing forbidden by layer rules.
 *
 * The number is formatted with the currency's `numberLocale` (CHF → `de-CH`
 * apostrophe grouping, EUR → `fr-FR`) and the symbol is appended manually so the
 * layout matches the split-typography hero, `AppCurrencyPipe`, and the iOS app.
 * Building the symbol ourselves (instead of `style: 'currency'`) is what keeps
 * the symbol in suffix position — `de-CH`'s native currency pattern is prefix.
 */
export interface CurrencyFormatter {
  format(value: number): string;
}

const formatterCache = new Map<string, CurrencyFormatter>();

/**
 * Returns a cached {@link CurrencyFormatter} for the given currency and locale.
 *
 * If `locale` is omitted, the `numberLocale` from {@link CURRENCY_METADATA} is
 * used so CHF amounts render with the apostrophe group separator (`1’234.56`).
 * Falls back to `de-CH` (locale) / the raw code (symbol) for unknown currencies.
 */
export function getCurrencyFormatter(
  currency: SupportedCurrency | string,
  locale?: string,
): CurrencyFormatter {
  const meta = CURRENCY_METADATA[currency as SupportedCurrency];
  const resolvedLocale = locale ?? meta?.numberLocale ?? 'de-CH';
  const symbol = meta?.symbol ?? currency;
  const key = `${resolvedLocale}_${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    const numberFormat = new Intl.NumberFormat(resolvedLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatter = {
      format: (value: number) => `${numberFormat.format(value)} ${symbol}`,
    };
    formatterCache.set(key, formatter);
  }
  return formatter;
}
