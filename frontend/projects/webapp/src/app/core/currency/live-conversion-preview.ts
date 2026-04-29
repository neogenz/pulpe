import { computed, inject, resource, type Signal } from '@angular/core';
import type { SupportedCurrency } from 'pulpe-shared';

import { CurrencyConverterService } from './currency-converter.service';

export type LivePreviewStatus =
  | 'hidden'
  | 'loading'
  | 'ready'
  | 'fallback'
  | 'error';

export interface LivePreviewState {
  readonly status: LivePreviewStatus;
  readonly convertedAmount?: number;
  readonly rate?: number;
  readonly cachedDate?: string;
}

/**
 * Live conversion preview for amount-entry dialogs.
 *
 * Given a typed amount and a pair of currencies, returns a reactive state
 * describing what the amount becomes once converted into `displayCurrency`.
 *
 * Uses `resource()` (not `httpResource()`) because `fetchRate()` already
 * wraps HTTP + ngx-ziflux SWR + fallback in a single promise — we want the
 * whole behaviour, not a raw GET.
 *
 * The resource is keyed on the currency pair, so typing a new amount only
 * triggers a `computed()` recomputation (`amount × rate`), never a new
 * network call.
 */
export function injectLiveConversionPreview(
  amount: Signal<number | null | undefined>,
  inputCurrency: Signal<SupportedCurrency>,
  displayCurrency: Signal<SupportedCurrency>,
): Signal<LivePreviewState> {
  const converter = inject(CurrencyConverterService);

  const rateResource = resource({
    params: () => {
      const base = inputCurrency();
      const target = displayCurrency();
      if (base === target) return undefined;
      return { base, target };
    },
    loader: ({ params }) => converter.fetchRate(params.base, params.target),
  });

  return computed<LivePreviewState>(() => {
    const base = inputCurrency();
    const target = displayCurrency();
    if (base === target) return { status: 'hidden' };

    const value = amount();
    if (value == null || !Number.isFinite(value) || value <= 0)
      return { status: 'hidden' };

    if (rateResource.isLoading()) return { status: 'loading' };
    if (rateResource.error()) return { status: 'error' };

    const result = rateResource.value();
    // resource() retains the prior pair's value() during reload — treat any
    // status outside `resolved` as loading to avoid surfacing stale rates.
    if (!result || rateResource.status() !== 'resolved') {
      return { status: 'loading' };
    }

    const convertedAmount = Number(
      converter.convert(value, result.rate).toFixed(2),
    );

    return {
      status: result.fromFallback ? 'fallback' : 'ready',
      convertedAmount,
      rate: result.rate,
      cachedDate: result.cachedDate,
    };
  });
}
