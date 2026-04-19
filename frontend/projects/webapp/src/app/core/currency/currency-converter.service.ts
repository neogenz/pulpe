import { inject, Injectable } from '@angular/core';
import { DataCache } from 'ngx-ziflux';
import { firstValueFrom } from 'rxjs';
import {
  type SupportedCurrency,
  currencyRateResponseSchema,
} from 'pulpe-shared';

import { ApiClient } from '@core/api/api-client';

const FRESH_MS = 5 * 60 * 1000;
const EXPIRE_MS = 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class CurrencyConverterService {
  readonly #api = inject(ApiClient);

  readonly #cache = new DataCache({
    name: 'currency-rates',
    staleTime: FRESH_MS,
    expireTime: EXPIRE_MS,
  });

  async fetchRate(
    base: SupportedCurrency,
    target: SupportedCurrency,
  ): Promise<number> {
    if (base === target) return 1;

    const key = ['currency', 'rate', base, target];
    const cached = this.#cache.get<number>(key);
    if (cached?.fresh) return cached.data;

    return this.#cache.deduplicate(key, async () => {
      const response = await firstValueFrom(
        this.#api.get$(
          `/currency/rate?base=${base}&target=${target}`,
          currencyRateResponseSchema,
        ),
      );
      this.#cache.set(key, response.data.rate);
      return response.data.rate;
    });
  }

  convert(amount: number, rate: number): number {
    return amount * rate;
  }

  async convertIfNeeded(
    amount: number,
    inputCurrency: SupportedCurrency,
    targetCurrency: SupportedCurrency,
  ): Promise<number> {
    if (inputCurrency === targetCurrency) return amount;
    const rate = await this.fetchRate(inputCurrency, targetCurrency);
    return Number(this.convert(amount, rate).toFixed(2));
  }

  async convertWithMetadata(
    amount: number,
    inputCurrency: SupportedCurrency,
    targetCurrency: SupportedCurrency,
  ): Promise<CurrencyConversionResult> {
    if (inputCurrency === targetCurrency) {
      return { convertedAmount: amount, metadata: null };
    }
    const rate = await this.fetchRate(inputCurrency, targetCurrency);
    return {
      convertedAmount: Number(this.convert(amount, rate).toFixed(2)),
      metadata: {
        originalAmount: amount,
        originalCurrency: inputCurrency,
        targetCurrency,
        exchangeRate: rate,
      },
    };
  }
}

export interface CurrencyMetadata {
  originalAmount: number;
  originalCurrency: SupportedCurrency;
  targetCurrency: SupportedCurrency;
  exchangeRate: number;
}

export interface CurrencyConversionResult {
  convertedAmount: number;
  metadata: CurrencyMetadata | null;
}
