import { computed, inject, signal, type Signal } from '@angular/core';
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

export interface EditCurrencyLineSource {
  readonly originalCurrency?: SupportedCurrency | null;
  readonly originalAmount?: number | null;
}

/**
 * Edit-mode sibling of `injectCurrencyFormConfig()`.
 *
 * PUL-99 v1 forbids changing the currency of an existing line. The picker is
 * therefore always read-only when shown, and `inputCurrency` is exposed as a
 * read-only `Signal`. Callers:
 *  - Render the picker only when `showCurrencySelector()` is `true` (feature
 *    flag ON + line has an `originalCurrency` that differs from the user's).
 *  - Skip `convertWithMetadata` and omit currency metadata from the PATCH in
 *    every other case so the backend preserves existing metadata.
 *
 * All derived signals are lazy — they only read `line()` when consumed by the
 * template — so the helper safely composes with `input.required<T>()` signal
 * inputs that aren't yet bound at field-initializer time.
 */
export function injectCurrencyFormConfigForEdit(
  line: Signal<EditCurrencyLineSource>,
) {
  const userSettings = inject(UserSettingsStore);
  const converter = inject(CurrencyConverterService);
  const flags = inject(FeatureFlagsService);

  const currency = userSettings.currency;
  const originalCurrency = computed(() => line().originalCurrency ?? null);
  const originalAmount = computed(() => line().originalAmount ?? null);

  const showCurrencySelector = computed(() => {
    if (!flags.isMultiCurrencyEnabled()) return false;
    const original = originalCurrency();
    return original !== null && original !== currency();
  });

  const inputCurrency = computed<SupportedCurrency>(
    () => originalCurrency() ?? currency(),
  );
  const conversionError = signal(false);

  return {
    currency,
    showCurrencySelector,
    inputCurrency,
    conversionError,
    converter,
    originalCurrency,
    originalAmount,
  };
}
