import { describe, it, expect } from 'bun:test';
import {
  DEFAULT_BUSINESS_TIMEZONE,
  formatBusinessCalendarDate,
} from './business-calendar-date';

describe('formatBusinessCalendarDate', () => {
  it('formats a known instant in Europe/Zurich as YYYY-MM-DD', () => {
    const d = new Date('2026-06-15T22:30:00.000Z');
    expect(formatBusinessCalendarDate(d)).toBe('2026-06-16');
    expect(DEFAULT_BUSINESS_TIMEZONE).toBe('Europe/Zurich');
  });

  it('accepts an explicit IANA zone', () => {
    const d = new Date('2026-01-01T12:00:00.000Z');
    expect(formatBusinessCalendarDate(d, 'UTC')).toBe('2026-01-01');
  });
});
