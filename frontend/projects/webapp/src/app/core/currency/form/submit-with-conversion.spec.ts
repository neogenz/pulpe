import { describe, it, expect, vi } from 'vitest';

import type { Logger } from '@core/logging/logger';

import type { CurrencyConverterService } from '../conversion/currency-converter.service';
import type { AmountFormSlice } from './amount-form.types';
import { submitWithConversion } from './submit-with-conversion';

interface BuiltDto {
  amount: number;
  conversion: { exchangeRate: number } | null;
}

function makeConverter(
  overrides: Partial<CurrencyConverterService> = {},
): CurrencyConverterService {
  return {
    convertWithMetadata: vi.fn().mockResolvedValue({
      convertedAmount: 0,
      metadata: null,
    }),
    ...overrides,
  } as unknown as CurrencyConverterService;
}

function makeLogger(): Logger {
  return { error: vi.fn() } as unknown as Logger;
}

describe('submitWithConversion', () => {
  it('returns invalid when amount slice is empty', async () => {
    const slice: AmountFormSlice = { amount: null, inputCurrency: 'CHF' };
    const converter = makeConverter();
    const logger = makeLogger();

    const outcome = await submitWithConversion({
      amountSlice: slice,
      targetCurrency: 'CHF',
      converter,
      logger,
      build: () => ({ amount: 0, conversion: null }),
    });

    expect(outcome).toEqual({ status: 'invalid' });
    expect(converter.convertWithMetadata).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('converts the amount and runs build, returns ok with built value', async () => {
    const slice: AmountFormSlice = { amount: 100, inputCurrency: 'EUR' };
    const converter = makeConverter({
      convertWithMetadata: vi.fn().mockResolvedValue({
        convertedAmount: 95,
        metadata: {
          originalAmount: 100,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 0.95,
        },
      }),
    } as unknown as Partial<CurrencyConverterService>);
    const logger = makeLogger();

    const outcome = await submitWithConversion<BuiltDto>({
      amountSlice: slice,
      targetCurrency: 'CHF',
      converter,
      logger,
      build: (amount, metadata) => ({
        amount,
        conversion: metadata ? { exchangeRate: metadata.exchangeRate } : null,
      }),
    });

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      100,
      'EUR',
      'CHF',
    );
    expect(outcome).toEqual({
      status: 'ok',
      value: { amount: 95, conversion: { exchangeRate: 0.95 } },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns failed and logs when converter throws', async () => {
    const slice: AmountFormSlice = { amount: 100, inputCurrency: 'EUR' };
    const apiError = new Error('rate API down');
    const converter = makeConverter({
      convertWithMetadata: vi.fn().mockRejectedValue(apiError),
    } as unknown as Partial<CurrencyConverterService>);
    const logger = makeLogger();
    const build = vi.fn();

    const outcome = await submitWithConversion({
      amountSlice: slice,
      targetCurrency: 'CHF',
      converter,
      logger,
      build,
    });

    expect(outcome).toEqual({ status: 'failed' });
    expect(build).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Currency conversion or schema parse failed',
      apiError,
    );
  });

  it('returns failed and logs when build throws (e.g., Zod parse)', async () => {
    const slice: AmountFormSlice = { amount: 100, inputCurrency: 'CHF' };
    const converter = makeConverter({
      convertWithMetadata: vi.fn().mockResolvedValue({
        convertedAmount: 100,
        metadata: null,
      }),
    } as unknown as Partial<CurrencyConverterService>);
    const logger = makeLogger();
    const parseError = new Error('schema invalid');

    const outcome = await submitWithConversion({
      amountSlice: slice,
      targetCurrency: 'CHF',
      converter,
      logger,
      build: () => {
        throw parseError;
      },
    });

    expect(outcome).toEqual({ status: 'failed' });
    expect(logger.error).toHaveBeenCalledWith(
      'Currency conversion or schema parse failed',
      parseError,
    );
  });

  it('passes converted amount as a number (narrowed) to build', async () => {
    const slice: AmountFormSlice = { amount: 50, inputCurrency: 'CHF' };
    const converter = makeConverter({
      convertWithMetadata: vi.fn().mockResolvedValue({
        convertedAmount: 50,
        metadata: null,
      }),
    } as unknown as Partial<CurrencyConverterService>);
    const logger = makeLogger();

    const outcome = await submitWithConversion({
      amountSlice: slice,
      targetCurrency: 'CHF',
      converter,
      logger,
      build: (amount) => {
        expect(typeof amount).toBe('number');
        return amount;
      },
    });

    expect(outcome).toEqual({ status: 'ok', value: 50 });
  });
});
