import { describe, it, expect } from 'vitest';
import { getDateDisplayFormats } from './date-display-formats';

describe('getDateDisplayFormats', () => {
  it('returns dot-separated formats for CHF', () => {
    expect(getDateDisplayFormats('CHF')).toEqual({
      shortDate: 'dd.MM.yyyy',
      dayMonth: 'dd.MM',
      monthYear: 'MM.yyyy',
      separator: '.',
    });
  });

  it('returns slash-separated formats for EUR', () => {
    expect(getDateDisplayFormats('EUR')).toEqual({
      shortDate: 'dd/MM/yyyy',
      dayMonth: 'dd/MM',
      monthYear: 'MM/yyyy',
      separator: '/',
    });
  });
});
