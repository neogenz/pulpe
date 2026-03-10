import { CurrencyPipe } from '@angular/common';
import { inject, Pipe, type PipeTransform } from '@angular/core';

import { UserSettingsStore } from '@core/user-settings';

import { CURRENCY_CONFIG, DEFAULT_DIGITS_INFO } from './currency-config';

@Pipe({
  name: 'appCurrency',
  pure: true,
})
export class AppCurrencyPipe implements PipeTransform {
  readonly #userSettings = inject(UserSettingsStore);
  readonly #currencyPipe = new CurrencyPipe('en');

  transform(
    value: number | string | null | undefined,
    digitsInfo: string = DEFAULT_DIGITS_INFO,
  ): string | null {
    const currency = this.#userSettings.currency();
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
