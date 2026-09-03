import { describe, it, expect } from 'vitest';
import {
  getDateDisplayFormats,
  getMonthYearDateFormats,
} from './date-display-formats';

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

  it.each([
    ['CHF', 'MM.yyyy'],
    ['EUR', 'MM/yyyy'],
  ] as const)(
    'builds shared month/year formats for %s',
    (currency, expected) => {
      expect(getMonthYearDateFormats(currency)).toMatchObject({
        parse: { dateInput: ['MM.yyyy', 'MM/yyyy'] },
        display: { dateInput: expected, dateA11yLabel: expected },
      });
    },
  );
});
