import { describe, expect, it } from 'vitest';

import { isCurrencyPickerVisible } from './picker-visibility';

describe('isCurrencyPickerVisible', () => {
  it('returns false when the multi-currency flag is off', () => {
    const result = isCurrencyPickerVisible({
      isMultiCurrencyEnabled: false,
      originalCurrency: 'EUR',
      userCurrency: 'CHF',
    });

    expect(result).toBe(false);
  });

  it('returns false when the flag is on but originalCurrency is null', () => {
    const result = isCurrencyPickerVisible({
      isMultiCurrencyEnabled: true,
      originalCurrency: null,
      userCurrency: 'CHF',
    });

    expect(result).toBe(false);
  });

  it('returns false when the flag is on and originalCurrency equals userCurrency', () => {
    const result = isCurrencyPickerVisible({
      isMultiCurrencyEnabled: true,
      originalCurrency: 'CHF',
      userCurrency: 'CHF',
    });

    expect(result).toBe(false);
  });

  it('returns true when the flag is on and originalCurrency differs from userCurrency', () => {
    const result = isCurrencyPickerVisible({
      isMultiCurrencyEnabled: true,
      originalCurrency: 'EUR',
      userCurrency: 'CHF',
    });

    expect(result).toBe(true);
  });
});
