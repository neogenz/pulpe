import { describe, expect, it } from 'vitest';
import { getCurrencyFormatter } from './currency-format.js';

const NARROW_NO_BREAK_SPACE = ' ';
// de-CH grouping is an apostrophe, but the exact codepoint depends on the
// runtime's ICU: browsers/macOS emit U+2019 (’), Linux Node emits U+0027 (').
// Production runs in the browser (U+2019); the test only asserts apostrophe-family.
const APOSTROPHE_GROUP = /1['’]234/;

describe('getCurrencyFormatter', () => {
  it('should group CHF with an apostrophe and suffix the symbol (de-CH)', () => {
    const formatted = getCurrencyFormatter('CHF').format(1234.56);

    expect(formatted).toMatch(APOSTROPHE_GROUP);
    expect(formatted).toContain('234.56');
    expect(formatted.endsWith('CHF')).toBe(true);
    expect(formatted).not.toContain(`1${NARROW_NO_BREAK_SPACE}234`);
  });

  it('should keep the EUR format with a space group and suffix € (fr-FR)', () => {
    const formatted = getCurrencyFormatter('EUR').format(1234.56);

    expect(formatted).toContain('234,56');
    expect(formatted.endsWith('€')).toBe(true);
  });

  it('should honour an explicit locale argument', () => {
    const formatted = getCurrencyFormatter('CHF', 'fr-FR').format(1234.56);

    expect(formatted).toContain('234,56');
    expect(formatted.endsWith('CHF')).toBe(true);
  });
});
