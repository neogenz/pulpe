import { inject, Injectable } from '@angular/core';
import { DataCache } from 'ngx-ziflux';
import { firstValueFrom } from 'rxjs';
import {
  type SupportedCurrency,
  currencyRateResponseSchema,
} from 'pulpe-shared';

import { ApiClient } from '@core/api/api-client';

import type {
  CurrencyConversionResult,
  FetchRateResult,
} from './currency.types';

const FRESH_MS = 5 * 60 * 1000;
const EXPIRE_MS = 60 * 60 * 1000;

/**
 * Cached payload for a currency pair.
 * We store the API `date` alongside the rate so stale-cache fallbacks can
 * surface the reference date in the UI ("Taux du dd MMM").
 */
interface CachedRate {
  rate: number;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class CurrencyConverterService {
  readonly #api = inject(ApiClient);

  readonly #cache = new DataCache({
    name: 'currency-rates',
    staleTime: FRESH_MS,
    expireTime: EXPIRE_MS,
  });

  /**
   * Returns the exchange rate for `base → target` with SWR semantics and a
   * stale-cache fallback when the live fetch fails.
   *
   * - Same currency: short-circuits to `{ rate: 1 }`.
   * - Fresh cache: returns the cached rate with `cachedDate`.
   * - Stale cache (older than `FRESH_MS`, still within `EXPIRE_MS`):
   *   attempts a refresh; on failure, returns the stale entry with
   *   `fromFallback: true`.
   * - Expired or absent cache: attempts a refresh; propagates the error
   *   on failure since there is nothing useful to fall back to.
   */
  async fetchRate(
    base: SupportedCurrency,
    target: SupportedCurrency,
  ): Promise<FetchRateResult> {
    if (base === target) return { rate: 1 };

    const key = ['currency', 'rate', base, target];
    const cached = this.#cache.get<CachedRate>(key);
    if (cached?.fresh) {
      return { rate: cached.data.rate, cachedDate: cached.data.date };
    }

    try {
      return await this.#cache.deduplicate(key, async () => {
        const response = await firstValueFrom(
          this.#api.get$(
            `/currency/rate?base=${base}&target=${target}`,
            currencyRateResponseSchema,
          ),
        );
        const payload: CachedRate = {
          rate: response.data.rate,
          date: response.data.date,
        };
        this.#cache.set(key, payload);
        return { rate: payload.rate, cachedDate: payload.date };
      });
    } catch (error) {
      if (cached) {
        return {
          rate: cached.data.rate,
          fromFallback: true,
          cachedDate: cached.data.date,
        };
      }
      throw error;
    }
  }

  convert(amount: number, rate: number): number {
    return amount * rate;
  }

  async convertWithMetadata(
    amount: number,
    inputCurrency: SupportedCurrency,
    targetCurrency: SupportedCurrency,
  ): Promise<CurrencyConversionResult> {
    if (inputCurrency === targetCurrency) {
      return { convertedAmount: amount, metadata: null };
    }
    const { rate, cachedDate, fromFallback } = await this.fetchRate(
      inputCurrency,
      targetCurrency,
    );
    return {
      convertedAmount: Number(this.convert(amount, rate).toFixed(2)),
      metadata: {
        originalAmount: amount,
        originalCurrency: inputCurrency,
        targetCurrency,
        exchangeRate: rate,
      },
      cachedDate,
      fromFallback,
    };
  }
}
