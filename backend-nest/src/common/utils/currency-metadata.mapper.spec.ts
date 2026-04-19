import { describe, it, expect } from 'bun:test';
import { mapCurrencyMetadataToDb } from './currency-metadata.mapper';

describe('mapCurrencyMetadataToDb', () => {
  it('should return an empty object when no currency fields are provided', () => {
    const result = mapCurrencyMetadataToDb({});

    expect(result).toEqual({});
  });

  it('should emit only the original_currency key when only originalCurrency is set', () => {
    const result = mapCurrencyMetadataToDb({ originalCurrency: 'EUR' });

    expect(result).toEqual({ original_currency: 'EUR' });
    expect(result).not.toHaveProperty('target_currency');
    expect(result).not.toHaveProperty('exchange_rate');
  });

  it('should emit only the target_currency key when only targetCurrency is set', () => {
    const result = mapCurrencyMetadataToDb({ targetCurrency: 'CHF' });

    expect(result).toEqual({ target_currency: 'CHF' });
    expect(result).not.toHaveProperty('original_currency');
    expect(result).not.toHaveProperty('exchange_rate');
  });

  it('should emit only the exchange_rate key when only exchangeRate is set', () => {
    const result = mapCurrencyMetadataToDb({ exchangeRate: 1.08 });

    expect(result).toEqual({ exchange_rate: 1.08 });
    expect(result).not.toHaveProperty('original_currency');
    expect(result).not.toHaveProperty('target_currency');
  });

  it('should emit all three keys when the full currency metadata is provided', () => {
    const result = mapCurrencyMetadataToDb({
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
    const result = mapCurrencyMetadataToDb({
      originalCurrency: null,
      exchangeRate: null,
    });

    expect(result).toEqual({
      original_currency: null,
      exchange_rate: null,
    });
    expect(result).not.toHaveProperty('target_currency');
  });
});
