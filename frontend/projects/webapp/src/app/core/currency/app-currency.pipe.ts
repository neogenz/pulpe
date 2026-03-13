import { CurrencyPipe } from '@angular/common';
import { Pipe, type PipeTransform } from '@angular/core';

import type { SupportedCurrency } from 'pulpe-shared';

import { CURRENCY_CONFIG, DEFAULT_DIGITS_INFO } from './currency-config';

@Pipe({
  name: 'appCurrency',
  pure: false,
})
export class AppCurrencyPipe implements PipeTransform {
  readonly #currencyPipe = new CurrencyPipe('en');

  transform(
    value: number | string | null | undefined,
    currency: SupportedCurrency,
    digitsInfo: string = DEFAULT_DIGITS_INFO,
  ): string | null {
    const config = CURRENCY_CONFIG[currency];
    return this.#currencyPipe.transform(
      value,
      currency,
      'symbol',
      digitsInfo,
      config.locale,
    );
  }
}
