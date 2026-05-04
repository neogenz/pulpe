import {
  provideZonelessChangeDetection,
  signal,
  type Signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupportedCurrency } from 'pulpe-shared';

import { CurrencyConverterService } from './currency-converter.service';
import type { FetchRateResult } from './currency.types';
import {
  injectLiveConversionPreview,
  type LivePreviewState,
} from './live-conversion-preview';

/**
 * Deferred promise so tests can pause the loader at will and verify the
 * intermediate `loading` state before the rate resolves.
 */
function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  TestBed.flushEffects();
  await Promise.resolve();
  TestBed.flushEffects();
}

describe('injectLiveConversionPreview', () => {
  let fetchRate: ReturnType<typeof vi.fn>;
  let convert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchRate = vi.fn();
    convert = vi.fn((amount: number, rate: number) => amount * rate);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: CurrencyConverterService, useValue: { fetchRate, convert } },
      ],
    });
  });

  function setup(params: {
    amount: number | null;
    input: SupportedCurrency;
    display: SupportedCurrency;
  }): {
    preview: Signal<LivePreviewState>;
    amount: ReturnType<typeof signal<number | null>>;
    input: ReturnType<typeof signal<SupportedCurrency>>;
    display: ReturnType<typeof signal<SupportedCurrency>>;
  } {
    const amount = signal<number | null>(params.amount);
    const input = signal<SupportedCurrency>(params.input);
    const display = signal<SupportedCurrency>(params.display);
    const preview = TestBed.runInInjectionContext(() =>
      injectLiveConversionPreview(amount, input, display),
    );
    return { preview, amount, input, display };
  }

  describe('rendering gate (status: hidden)', () => {
    it('returns hidden when input and display currencies are equal', async () => {
      const { preview } = setup({ amount: 100, input: 'EUR', display: 'EUR' });

      await flush();

      expect(preview().status).toBe('hidden');
      expect(fetchRate).not.toHaveBeenCalled();
    });

    it('returns hidden when the amount is null', async () => {
      const { preview } = setup({ amount: null, input: 'CHF', display: 'EUR' });

      await flush();

      expect(preview().status).toBe('hidden');
    });

    it('returns hidden when the amount is zero', async () => {
      const { preview } = setup({ amount: 0, input: 'CHF', display: 'EUR' });

      await flush();

      expect(preview().status).toBe('hidden');
    });

    it('returns hidden when the amount is negative', async () => {
      const { preview } = setup({ amount: -5, input: 'CHF', display: 'EUR' });

      await flush();

      expect(preview().status).toBe('hidden');
    });
  });

  describe('loading state', () => {
    it('emits loading while the rate is in flight', async () => {
      const { promise } = defer<FetchRateResult>();
      fetchRate.mockReturnValueOnce(promise);

      const { preview } = setup({
        amount: 100,
        input: 'CHF',
        display: 'EUR',
      });

      await flush();

      expect(preview().status).toBe('loading');
    });
  });

  describe('ready state', () => {
    it('returns the converted amount rounded to two decimals', async () => {
      fetchRate.mockResolvedValueOnce({
        rate: 1.0899,
      } satisfies FetchRateResult);

      const { preview } = setup({
        amount: 100,
        input: 'CHF',
        display: 'EUR',
      });

      await flush();

      expect(preview().status).toBe('ready');
      expect(preview().rate).toBe(1.0899);
      expect(preview().convertedAmount).toBe(108.99);
    });

    it('delegates the multiplication to CurrencyConverterService.convert', async () => {
      fetchRate.mockResolvedValueOnce({ rate: 2 } satisfies FetchRateResult);

      const { preview } = setup({
        amount: 50,
        input: 'CHF',
        display: 'EUR',
      });

      await flush();

      expect(preview().convertedAmount).toBe(100);
      expect(convert).toHaveBeenCalledWith(50, 2);
    });
  });

  describe('fallback state', () => {
    it('propagates cachedDate and marks the status as fallback', async () => {
      fetchRate.mockResolvedValueOnce({
        rate: 1.08,
        fromFallback: true,
        cachedDate: '2026-04-22',
      } satisfies FetchRateResult);

      const { preview } = setup({
        amount: 100,
        input: 'CHF',
        display: 'EUR',
      });

      await flush();

      expect(preview().status).toBe('fallback');
      expect(preview().cachedDate).toBe('2026-04-22');
      expect(preview().convertedAmount).toBe(108);
    });
  });

  describe('error state', () => {
    it('returns error when the loader rejects without a cached fallback', async () => {
      fetchRate.mockRejectedValueOnce(new Error('Network down'));

      const { preview } = setup({
        amount: 100,
        input: 'CHF',
        display: 'EUR',
      });

      await flush();

      expect(preview().status).toBe('error');
    });
  });

  describe('reactivity', () => {
    it('recomputes the converted amount without refetching when the amount changes', async () => {
      fetchRate.mockResolvedValueOnce({ rate: 2 } satisfies FetchRateResult);

      const { preview, amount } = setup({
        amount: 10,
        input: 'CHF',
        display: 'EUR',
      });

      await flush();
      expect(preview().convertedAmount).toBe(20);

      amount.set(25);
      await flush();

      expect(preview().convertedAmount).toBe(50);
      expect(fetchRate).toHaveBeenCalledTimes(1);
    });

    it('fetches a fresh rate when the currency pair changes', async () => {
      fetchRate
        .mockResolvedValueOnce({ rate: 1.08 } satisfies FetchRateResult)
        .mockResolvedValueOnce({ rate: 0.92 } satisfies FetchRateResult);

      const { preview, input, display } = setup({
        amount: 100,
        input: 'CHF',
        display: 'EUR',
      });

      await flush();
      expect(preview().rate).toBe(1.08);

      input.set('EUR');
      display.set('CHF');
      await flush();

      expect(preview().rate).toBe(0.92);
      expect(fetchRate).toHaveBeenCalledTimes(2);
    });
  });
});
