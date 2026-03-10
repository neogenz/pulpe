import { inject, Injectable } from '@angular/core';
import type { SupportedCurrency } from 'pulpe-shared';
import { firstValueFrom, map, of, tap, type Observable } from 'rxjs';
import { z } from 'zod';

import { ApiClient } from '@core/api/api-client';

const currencyRateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    base: z.string(),
    target: z.string(),
    rate: z.number(),
  }),
});

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

@Injectable({ providedIn: 'root' })
export class CurrencyConverterService {
  readonly #api = inject(ApiClient);
  readonly #cache = new Map<string, CachedRate>();

  fetchRate$(
    base: SupportedCurrency,
    target: SupportedCurrency,
  ): Observable<number> {
    const key = `${base}-${target}`;
    const cached = this.#cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return of(cached.rate);
    }

    return this.#api
      .get$(
        `/currency/rate?base=${base}&target=${target}`,
        currencyRateResponseSchema,
      )
      .pipe(
        map((res) => res.data.rate),
        tap((rate) => this.#cache.set(key, { rate, fetchedAt: Date.now() })),
      );
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
    const rate = await firstValueFrom(
      this.fetchRate$(inputCurrency, targetCurrency),
    );
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
    const rate = await firstValueFrom(
      this.fetchRate$(inputCurrency, targetCurrency),
    );
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
