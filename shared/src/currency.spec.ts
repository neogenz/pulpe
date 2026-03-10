import { describe, expect, it } from 'vitest';
import { supportedCurrencySchema } from '../schemas.js';

describe('supportedCurrencySchema', () => {
  it.each(['CHF', 'EUR'])('should accept valid currency: %s', (currency) => {
    const result = supportedCurrencySchema.safeParse(currency);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(currency);
    }
  });

  it.each(['USD', 'GBP', '', 0, null, undefined])(
    'should reject invalid value: %s',
    (value) => {
      const result = supportedCurrencySchema.safeParse(value);
      expect(result.success).toBe(false);
    },
  );
});
