import { inject, signal } from '@angular/core';
import type { SupportedCurrency } from 'pulpe-shared';

import { UserSettingsStore } from '@core/user-settings';
import { CurrencyConverterService } from './currency-converter.service';

export function injectCurrencyFormConfig() {
  const userSettings = inject(UserSettingsStore);
  const converter = inject(CurrencyConverterService);
  const currency = userSettings.currency;
  const showCurrencySelector = userSettings.showCurrencySelector;
  const inputCurrency = signal<SupportedCurrency>(currency());
  const conversionError = signal(false);

  return {
    currency,
    showCurrencySelector,
    inputCurrency,
    conversionError,
    converter,
  };
}
