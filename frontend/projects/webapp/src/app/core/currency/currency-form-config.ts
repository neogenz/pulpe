import {
  computed,
  inject,
  linkedSignal,
  signal,
  type Signal,
} from '@angular/core';
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
 * Rules:
 *  - `inputCurrency` is locked to `line.originalCurrency ?? userCurrency`.
 *  - The picker is ONLY shown when the feature flag is ON AND the line has an
 *    `originalCurrency` that differs from the user's current currency.
 *  - In every other case (mono-currency lines, same currency, flag OFF), the
 *    picker is hidden — in which case callers MUST skip `convertWithMetadata`
 *    and omit `originalAmount`/`originalCurrency`/`targetCurrency`/
 *    `exchangeRate` from the PATCH so the backend preserves existing metadata.
 *
 * A Signal-typed source is accepted so this helper composes with both
 * `MAT_DIALOG_DATA` (plain value wrapped in `signal(...)`) and component
 * signal inputs (`input.required<Transaction>()`) — the latter cannot be read
 * synchronously at injection time.
 */
export function injectCurrencyFormConfigForEdit(
  line: Signal<EditCurrencyLineSource>,
) {
  const userSettings = inject(UserSettingsStore);
  const converter = inject(CurrencyConverterService);
  const flags = inject(FeatureFlagsService);

  const currency = userSettings.currency;

  // Safe read: required signal inputs throw NG0950 until bound. The helper
  // may be called from field initializers (e.g. `input.required<Transaction>()`
  // read in a `linkedSignal` source) before the input is set. Falling back to
  // a null-shaped object keeps derived signals cold until the source is ready.
  const safeLine = computed<EditCurrencyLineSource>(() => {
    try {
      return line();
    } catch {
      return {};
    }
  });

  const originalCurrency = computed(() => safeLine().originalCurrency ?? null);
  const originalAmount = computed(() => safeLine().originalAmount ?? null);

  const showCurrencySelector = computed(() => {
    if (!flags.isMultiCurrencyEnabled()) return false;
    const original = originalCurrency();
    return original !== null && original !== currency();
  });

  // `linkedSignal` keeps `inputCurrency` in sync with the source line while
  // still allowing manual writes.
  const inputCurrency = linkedSignal<SupportedCurrency>(
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
