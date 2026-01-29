import { describe, it, expect } from 'vitest';
import { formatLocalDate } from './format-local-date';

describe('formatLocalDate', () => {
  it('should preserve the local date without UTC shift', () => {
    const date = new Date(2026, 0, 29, 0, 0, 0); // Jan 29, 2026, midnight local

    const result = formatLocalDate(date);

    expect(result).toBe('2026-01-29T00:00:00');
  });

  it('should preserve date when time is set', () => {
    const date = new Date(2026, 5, 15, 14, 30, 45); // Jun 15, 2026, 14:30:45

    const result = formatLocalDate(date);

    expect(result).toBe('2026-06-15T14:30:45');
  });

  it('should not include timezone suffix', () => {
    const date = new Date(2026, 0, 1);

    const result = formatLocalDate(date);

    expect(result).not.toContain('Z');
    expect(result).not.toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('should return a string that starts with the correct date regardless of timezone', () => {
    const date = new Date(2026, 11, 31, 23, 59, 59); // Dec 31, 2026, 23:59:59

    const result = formatLocalDate(date);

    expect(result).toMatch(/^2026-12-31/);
  });
});
