import { describe, it, expect } from 'bun:test';
import { mapCurrencyNonAmountMetadataToDb } from './currency-metadata.mapper';

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
    expect(() =>
      mapCurrencyNonAmountMetadataToDb({
        originalAmount: 120,
      } as never),
    ).toThrow('originalAmount must be encrypted separately');
  });

  it('should reject present originalAmount even when its value is undefined', () => {
    expect(() =>
      mapCurrencyNonAmountMetadataToDb({
        originalAmount: undefined,
      } as never),
    ).toThrow('originalAmount must be encrypted separately');
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

    expect(typeof compileTimeOnly).toBe('function');
  });
});
