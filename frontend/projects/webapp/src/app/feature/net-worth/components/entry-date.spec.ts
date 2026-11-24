import { describe, expect, it } from 'vitest';
import { formatEntryDate } from './entry-date';

const thisYear = (month: number, day: number) =>
  new Date(new Date().getFullYear(), month, day, 12).toISOString();
const NOVEMBER = 10;

describe('formatEntryDate', () => {
  it('should write the first of the month as « 1er » in French', () => {
    expect(formatEntryDate(thisYear(NOVEMBER, 1), 'fr-CH')).toBe(
      '1er novembre',
    );
  });

  it('should keep any other day as a plain number in French', () => {
    expect(formatEntryDate(thisYear(NOVEMBER, 15), 'fr-FR')).toBe(
      '15 novembre',
    );
  });

  it('should write the first of the month as « 1º » in Italian', () => {
    expect(formatEntryDate(thisYear(NOVEMBER, 1), 'it-CH')).toBe('1º novembre');
  });

  it('should leave the first of the month alone in English and German', () => {
    expect(formatEntryDate(thisYear(NOVEMBER, 1), 'en-US')).toBe('November 1');
    expect(formatEntryDate(thisYear(NOVEMBER, 1), 'de-CH')).toBe('1. November');
  });

  it('should add the year of an earlier year', () => {
    expect(formatEntryDate('2020-11-01T12:00:00.000Z', 'fr-FR')).toBe(
      '1er novembre 2020',
    );
  });
});
