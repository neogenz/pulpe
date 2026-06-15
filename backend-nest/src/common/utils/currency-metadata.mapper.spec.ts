import { describe, it, expect } from 'bun:test';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { mapCurrencyNonAmountMetadataToDb } from './currency-metadata.mapper';

function expectOriginalAmountGuard(input: never): void {
  try {
    mapCurrencyNonAmountMetadataToDb(input);
    throw new Error('expected originalAmount guard to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException);
    const businessError = error as BusinessException;
    expect(businessError.code).toBe(
      ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR.code,
    );
    expect(businessError.message).toBe('Internal server error');
    expect(businessError.loggingContext).toEqual({
      operation: 'mapCurrencyNonAmountMetadataToDb',
      violation: 'originalAmount present',
    });
    expect(businessError.cause).toBeInstanceOf(Error);
    expect((businessError.cause as Error).message).toBe(
      'originalAmount must be encrypted separately with encryptOptionalAmount',
    );
  }
}

describe('mapCurrencyNonAmountMetadataToDb', () => {
  it('should return an empty object when no currency fields are provided', () => {
    const result = mapCurrencyNonAmountMetadataToDb({});

    expect(result).toEqual({});
  });

  it('should emit only the original_currency key when only originalCurrency is set', () => {
    const result = mapCurrencyNonAmountMetadataToDb({
      originalCurrency: 'EUR',
    });

    expect(result).toEqual({ original_currency: 'EUR' });
    expect(result).not.toHaveProperty('target_currency');
    expect(result).not.toHaveProperty('exchange_rate');
  });

  it('should emit only the target_currency key when only targetCurrency is set', () => {
    const result = mapCurrencyNonAmountMetadataToDb({
      targetCurrency: 'CHF',
    });

    expect(result).toEqual({ target_currency: 'CHF' });
    expect(result).not.toHaveProperty('original_currency');
    expect(result).not.toHaveProperty('exchange_rate');
  });

  it('should emit only the exchange_rate key when only exchangeRate is set', () => {
    const result = mapCurrencyNonAmountMetadataToDb({ exchangeRate: 1.08 });

    expect(result).toEqual({ exchange_rate: 1.08 });
    expect(result).not.toHaveProperty('original_currency');
    expect(result).not.toHaveProperty('target_currency');
  });

  it('should emit all three keys when the full currency metadata is provided', () => {
    const result = mapCurrencyNonAmountMetadataToDb({
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 1.05,
    });

    expect(result).toEqual({
      original_currency: 'EUR',
      target_currency: 'CHF',
      exchange_rate: 1.05,
    });
  });

  it('should preserve explicit null as null (clearing intent)', () => {
    const result = mapCurrencyNonAmountMetadataToDb({
      originalCurrency: null,
      exchangeRate: null,
    });

    expect(result).toEqual({
      original_currency: null,
      exchange_rate: null,
    });
    expect(result).not.toHaveProperty('target_currency');
  });

  it('should reject originalAmount at runtime when callers bypass types', () => {
    expectOriginalAmountGuard({
      originalAmount: 120,
    } as never);
  });

  it('should reject present originalAmount even when its value is undefined', () => {
    expectOriginalAmountGuard({
      originalAmount: undefined,
    } as never);
  });

  it('should reject originalAmount at compile time', () => {
    type WideCurrencyPatch = {
      originalAmount?: number | null;
      originalCurrency?: Parameters<
        typeof mapCurrencyNonAmountMetadataToDb
      >[0]['originalCurrency'];
    };
    const patch: WideCurrencyPatch = {};
    const compileTimeOnly = () =>
      // @ts-expect-error originalAmount must be encrypted before DB mapping.
      mapCurrencyNonAmountMetadataToDb(patch);

    // Keep a runtime reference so TypeScript checks the closure without calling
    // it; the regression guard is the @ts-expect-error above.
    expect(typeof compileTimeOnly).toBe('function');
  });
});
