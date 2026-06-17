import { formatNumber } from '@angular/common';
import { Pipe, type PipeTransform } from '@angular/core';

import type { SupportedCurrency } from 'pulpe-shared';

import { CURRENCY_CONFIG, DEFAULT_DIGITS_INFO } from './currency-config';

/**
 * Formats a monetary value as `<number> <symbol>` with the symbol in suffix
 * position — `1’234.56 CHF` / `1 234,56 €`. The number uses the currency's
 * `numberLocale` (CHF → `de-CH` apostrophe grouping, EUR → `fr-FR`), and the
 * symbol is always appended so the layout matches the split-typography hero,
 * the `getCurrencyFormatter` helper, and the iOS app. `de-CH` is formatted via
 * Angular's bundled CLDR data, so the apostrophe (U+2019) is stable across
 * environments (unlike native `Intl`, whose ICU varies by platform).
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
    return `${formatNumber(amount, numberLocale, digitsInfo)} ${symbol}`;
  }
}
