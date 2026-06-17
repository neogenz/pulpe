import { describe, expect, it } from 'vitest';
import { getCurrencyFormatter } from './currency-format.js';

const APOSTROPHE = '’';
const NARROW_NO_BREAK_SPACE = ' ';

describe('getCurrencyFormatter', () => {
  it('should use the apostrophe group separator for CHF (de-CH)', () => {
    const formatted = getCurrencyFormatter('CHF').format(1234.56);

    expect(formatted).toContain(`1${APOSTROPHE}234`);
    expect(formatted).toContain('234.56');
    expect(formatted).not.toContain(`1${NARROW_NO_BREAK_SPACE}234`);
  });

  it('should keep the EUR format unchanged (fr-FR)', () => {
    const formatted = getCurrencyFormatter('EUR').format(1234.56);

    expect(formatted).toContain(`1${NARROW_NO_BREAK_SPACE}234`);
    expect(formatted).toContain('234,56');
  });

  it('should honour an explicit locale argument', () => {
    const formatted = getCurrencyFormatter('CHF', 'fr-CH').format(1234.56);

    expect(formatted).toContain(`1${NARROW_NO_BREAK_SPACE}234`);
  });
});
