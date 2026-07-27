import { describe, expect, it } from 'vitest';

import { isCurrencyPickerVisible } from './picker-visibility';

describe('isCurrencyPickerVisible', () => {
  it('returns false when originalCurrency is null', () => {
    const result = isCurrencyPickerVisible({
      originalCurrency: null,
      userCurrency: 'CHF',
    });

    expect(result).toBe(false);
  });

  it('returns false when originalCurrency equals userCurrency', () => {
    const result = isCurrencyPickerVisible({
      originalCurrency: 'CHF',
      userCurrency: 'CHF',
    });

    expect(result).toBe(false);
  });

  it('returns true when originalCurrency differs from userCurrency', () => {
    const result = isCurrencyPickerVisible({
      originalCurrency: 'EUR',
      userCurrency: 'CHF',
    });

    expect(result).toBe(true);
  });
});
