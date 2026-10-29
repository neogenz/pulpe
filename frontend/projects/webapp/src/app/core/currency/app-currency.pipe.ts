import { formatNumber } from '@angular/common';
import { Pipe, type PipeTransform } from '@angular/core';

import { hasCents, type SupportedCurrency } from 'pulpe-shared';

import { CURRENCY_CONFIG, DEFAULT_DIGITS_INFO } from './currency-config';

/**
 * Formats a monetary value as `<number> <symbol>` with the symbol in suffix
 * position — `1’234.56 CHF` / `1 234,56 €`. The number uses the currency's
 * `numberLocale` (CHF → `de-CH` apostrophe grouping, EUR → `fr-FR`), and the
 * symbol is always appended so the layout matches the split-typography hero,
 * the `getCurrencyFormatter` helper, and the iOS app. `de-CH` is formatted via
 * Angular's bundled CLDR data, so the apostrophe (U+2019) is stable across
 * environments (unlike native `Intl`, whose ICU varies by platform).
 *
 * `'1.0-2'` is the adaptive policy, not a literal range: 0 decimals on a whole
 * amount, 2 once it carries cents — never the single one `formatNumber` would
 * leave on `1960.5`.
 */
@Pipe({
  name: 'appCurrency',
})
export class AppCurrencyPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    currency: SupportedCurrency,
    digitsInfo: string = DEFAULT_DIGITS_INFO,
  ): string | null {
    if (value == null || value === '') return null;
    const amount = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(amount)) return null;

    const { numberLocale, symbol } = CURRENCY_CONFIG[currency];
    const digits =
      digitsInfo === '1.0-2'
        ? hasCents(amount)
          ? '1.2-2'
          : '1.0-0'
        : digitsInfo;
    return `${formatNumber(amount, numberLocale, digits)} ${symbol}`;
  }
}
