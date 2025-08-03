import { describe, it, expect } from 'bun:test';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';

describe('BudgetPeriod Value Object', () => {
  describe('create', () => {
    it('should create a valid budget period', () => {
      const result = BudgetPeriod.create(1, 2024);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.month).toBe(1);
      expect(result.value?.year).toBe(2024);
    });

    it('should fail with invalid month (too low)', () => {
      const result = BudgetPeriod.create(0, 2024);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Invalid month');
    });

    it('should fail with invalid month (too high)', () => {
      const result = BudgetPeriod.create(13, 2024);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Invalid month');
    });

    it('should fail with invalid year (too old)', () => {
      const result = BudgetPeriod.create(1, 2019);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Invalid year');
    });

    it('should fail with invalid year (too far in future)', () => {
      const currentYear = new Date().getFullYear();
      const result = BudgetPeriod.create(1, currentYear + 11);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Invalid year');
    });

    it('should fail if period is more than 2 years in future', () => {
      const now = new Date();
      const futureYear = now.getFullYear() + 3;
      const result = BudgetPeriod.create(1, futureYear);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain(
        'cannot be more than 2 years in the future',
      );
    });
  });

  describe('equals', () => {
    it('should return true for same period', () => {
      const period1 = BudgetPeriod.create(1, 2024).value!;
      const period2 = BudgetPeriod.create(1, 2024).value!;

      expect(period1.equals(period2)).toBe(true);
    });

    it('should return false for different month', () => {
      const period1 = BudgetPeriod.create(1, 2024).value!;
      const period2 = BudgetPeriod.create(2, 2024).value!;

      expect(period1.equals(period2)).toBe(false);
    });

    it('should return false for different year', () => {
      const period1 = BudgetPeriod.create(1, 2024).value!;
      const period2 = BudgetPeriod.create(1, 2025).value!;

      expect(period1.equals(period2)).toBe(false);
    });
  });

  describe('toDate', () => {
    it('should convert to correct date', () => {
      const period = BudgetPeriod.create(3, 2024).value!;
      const date = period.toDate();

      expect(date.getMonth()).toBe(2); // March is month 2 (0-indexed)
      expect(date.getFullYear()).toBe(2024);
      expect(date.getDate()).toBe(1);
    });
  });

  describe('toString', () => {
    it('should format as YYYY-MM', () => {
      const period = BudgetPeriod.create(3, 2024).value!;
      expect(period.toString()).toBe('2024-03');
    });

    it('should pad single digit months', () => {
      const period = BudgetPeriod.create(1, 2024).value!;
      expect(period.toString()).toBe('2024-01');
    });
  });

  describe('isFuture', () => {
    it('should return true for future period', () => {
      const futureYear = new Date().getFullYear() + 1;
      const period = BudgetPeriod.create(1, futureYear).value!;
      expect(period.isFuture()).toBe(true);
    });

    it('should return false for past period', () => {
      const period = BudgetPeriod.create(1, 2020).value!;
      expect(period.isFuture()).toBe(false);
    });

    it('should return false for current month', () => {
      const now = new Date();
      const period = BudgetPeriod.create(
        now.getMonth() + 1,
        now.getFullYear(),
      ).value!;
      expect(period.isFuture()).toBe(false);
    });
  });

  describe('isPast', () => {
    it('should return true for past period', () => {
      const period = BudgetPeriod.create(1, 2020).value!;
      expect(period.isPast()).toBe(true);
    });

    it('should return false for future period', () => {
      const futureYear = new Date().getFullYear() + 1;
      const period = BudgetPeriod.create(1, futureYear).value!;
      expect(period.isPast()).toBe(false);
    });

    it('should return false for current month', () => {
      const now = new Date();
      const period = BudgetPeriod.create(
        now.getMonth() + 1,
        now.getFullYear(),
      ).value!;
      expect(period.isPast()).toBe(false);
    });
  });

  describe('isCurrent', () => {
    it('should return true for current month', () => {
      const now = new Date();
      const period = BudgetPeriod.create(
        now.getMonth() + 1,
        now.getFullYear(),
      ).value!;
      expect(period.isCurrent()).toBe(true);
    });

    it('should return false for past period', () => {
      const period = BudgetPeriod.create(1, 2020).value!;
      expect(period.isCurrent()).toBe(false);
    });

    it('should return false for future period', () => {
      const futureYear = new Date().getFullYear() + 1;
      const period = BudgetPeriod.create(1, futureYear).value!;
      expect(period.isCurrent()).toBe(false);
    });
  });
});
