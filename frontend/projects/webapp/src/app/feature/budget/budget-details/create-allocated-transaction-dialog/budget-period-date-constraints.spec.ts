import { describe, it, expect, vi, afterEach } from 'vitest';
import { FormControl } from '@angular/forms';
import {
  computeBudgetPeriodDateConstraints,
  createDateRangeValidator,
} from './budget-period-date-constraints';

describe('computeBudgetPeriodDateConstraints', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return isCurrentMonth true with min/max dates for current month budget', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // 15 Jan 2026

    const result = computeBudgetPeriodDateConstraints(1, 2026, null);

    expect(result.isCurrentMonth).toBe(true);
    expect(result.minDate).toBeDefined();
    expect(result.maxDate).toBeDefined();
    expect(result.minDate!.getTime()).toBeLessThanOrEqual(
      result.maxDate!.getTime(),
    );
  });

  it('should return isCurrentMonth false with undefined dates for past month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // 15 Jan 2026

    const result = computeBudgetPeriodDateConstraints(6, 2025, null);

    expect(result.isCurrentMonth).toBe(false);
    expect(result.minDate).toBeUndefined();
    expect(result.maxDate).toBeUndefined();
  });

  it('should return isCurrentMonth false with undefined dates for future month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // 15 Jan 2026

    const result = computeBudgetPeriodDateConstraints(3, 2026, null);

    expect(result.isCurrentMonth).toBe(false);
    expect(result.minDate).toBeUndefined();
    expect(result.maxDate).toBeUndefined();
  });

  it('should handle year boundary with null payDayOfMonth', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 20)); // 20 Dec 2025

    const result = computeBudgetPeriodDateConstraints(12, 2025, null);

    expect(result.isCurrentMonth).toBe(true);
    expect(result.minDate).toBeDefined();
    expect(result.maxDate).toBeDefined();
  });

  it('should handle custom payDayOfMonth in first half of month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 10)); // 10 Jan 2026

    // payDay=5, first half: period is named after start month
    // Current date Jan 10, payDay 5 → current period = Jan 2026
    const result = computeBudgetPeriodDateConstraints(1, 2026, 5);

    expect(result.isCurrentMonth).toBe(true);
    expect(result.minDate).toBeDefined();
    expect(result.maxDate).toBeDefined();
    expect(result.minDate!.getDate()).toBe(5);
  });

  it('should handle custom payDayOfMonth in second half of month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 27)); // 27 Jun 2025

    // payDay=25, second half: period named after end month
    // Current date Jun 27, payDay 25 → dayOfMonth >= payDay → resultMonth = Jun
    // payDay > 15 → add 1 month → current period = Jul 2025
    const result = computeBudgetPeriodDateConstraints(7, 2025, 25);

    expect(result.isCurrentMonth).toBe(true);
    expect(result.minDate).toBeDefined();
    expect(result.maxDate).toBeDefined();
    expect(result.minDate!.getDate()).toBe(25);
  });

  it('should return correct period dates for standard calendar month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // 15 Mar 2026

    const result = computeBudgetPeriodDateConstraints(3, 2026, null);

    expect(result.isCurrentMonth).toBe(true);
    expect(result.minDate!.getMonth()).toBe(2); // March (0-indexed)
    expect(result.minDate!.getDate()).toBe(1);
    expect(result.maxDate!.getMonth()).toBe(2);
    expect(result.maxDate!.getDate()).toBe(31);
  });
});

describe('createDateRangeValidator', () => {
  it('should return null when date is within range', () => {
    const min = new Date(2026, 0, 1);
    const max = new Date(2026, 0, 31);
    const validator = createDateRangeValidator(min, max);

    const control = new FormControl(new Date(2026, 0, 15));

    expect(validator(control)).toBeNull();
  });

  it('should return error when date is before min', () => {
    const min = new Date(2026, 0, 5);
    const max = new Date(2026, 1, 4);
    const validator = createDateRangeValidator(min, max);

    const control = new FormControl(new Date(2026, 0, 3));

    expect(validator(control)).toEqual({ dateOutOfRange: true });
  });

  it('should return error when date is after max', () => {
    const min = new Date(2026, 0, 5);
    const max = new Date(2026, 1, 4);
    const validator = createDateRangeValidator(min, max);

    const control = new FormControl(new Date(2026, 1, 10));

    expect(validator(control)).toEqual({ dateOutOfRange: true });
  });

  it('should return null when date equals min boundary', () => {
    const min = new Date(2026, 0, 5);
    const max = new Date(2026, 1, 4);
    const validator = createDateRangeValidator(min, max);

    const control = new FormControl(new Date(2026, 0, 5));

    expect(validator(control)).toBeNull();
  });

  it('should return null when date equals max boundary', () => {
    const min = new Date(2026, 0, 5);
    const max = new Date(2026, 1, 4);
    const validator = createDateRangeValidator(min, max);

    const control = new FormControl(new Date(2026, 1, 4));

    expect(validator(control)).toBeNull();
  });

  it('should return null when control value is null', () => {
    const min = new Date(2026, 0, 1);
    const max = new Date(2026, 0, 31);
    const validator = createDateRangeValidator(min, max);

    const control = new FormControl(null);

    expect(validator(control)).toBeNull();
  });

  it('should return null when min is undefined', () => {
    const validator = createDateRangeValidator(
      undefined,
      new Date(2026, 0, 31),
    );

    const control = new FormControl(new Date(2025, 0, 1));

    expect(validator(control)).toBeNull();
  });

  it('should return null when max is undefined', () => {
    const validator = createDateRangeValidator(new Date(2026, 0, 1), undefined);

    const control = new FormControl(new Date(2027, 0, 1));

    expect(validator(control)).toBeNull();
  });
});
