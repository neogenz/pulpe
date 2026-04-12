import { computed, inject, signal } from '@angular/core';
import type { SupportedCurrency } from 'pulpe-shared';

import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import { CurrencyConverterService } from './currency-converter.service';

/**
 * Shared configuration hook for all forms that need currency handling.
 *
 * `showCurrencySelector` is gated by BOTH:
 *   1. The `MULTI_CURRENCY` feature flag (kill switch / rollout)
 *   2. The per-user `showCurrencySelector` preference
 *
 * When the feature flag is OFF, the currency picker is never rendered
 * regardless of the user's preference — the feature is effectively hidden.
 */
export function injectCurrencyFormConfig() {
  const userSettings = inject(UserSettingsStore);
  const converter = inject(CurrencyConverterService);
  const flags = inject(FeatureFlagsService);

  const currency = userSettings.currency;
  const showCurrencySelector = computed(
    () => flags.isMultiCurrencyEnabled() && userSettings.showCurrencySelector(),
  );
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
