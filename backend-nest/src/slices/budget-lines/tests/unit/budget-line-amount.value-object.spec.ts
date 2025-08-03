import { describe, it, expect } from 'bun:test';
import { BudgetLineAmount } from '../../domain/value-objects/budget-line-amount.value-object';

describe('BudgetLineAmount Value Object', () => {
  describe('create', () => {
    it('should create a valid amount', () => {
      const result = BudgetLineAmount.create(150.5);

      expect(result.isSuccess).toBe(true);
      const amount = result.getValue();
      expect(amount.value).toBe(150.5);
    });

    it('should round to 2 decimal places', () => {
      const result = BudgetLineAmount.create(100.999);

      expect(result.isSuccess).toBe(true);
      const amount = result.getValue();
      expect(amount.value).toBe(101.0);
    });

    it('should allow zero amount', () => {
      const result = BudgetLineAmount.create(0);

      expect(result.isSuccess).toBe(true);
      const amount = result.getValue();
      expect(amount.value).toBe(0);
      expect(amount.isZero()).toBe(true);
    });

    it('should fail for negative amounts', () => {
      const result = BudgetLineAmount.create(-10);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_AMOUNT');
      expect(result.error.message).toBe(
        'Budget line amount cannot be negative',
      );
    });

    it('should fail for non-finite numbers', () => {
      const result = BudgetLineAmount.create(Infinity);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_AMOUNT');
      expect(result.error.message).toBe(
        'Budget line amount must be a finite number',
      );
    });

    it('should fail for amounts exceeding maximum', () => {
      const result = BudgetLineAmount.create(1_000_001);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('AMOUNT_TOO_LARGE');
      expect(result.error.message).toBe('Budget line amount exceeds maximum');
    });
  });

  describe('arithmetic operations', () => {
    it('should add two amounts', () => {
      const amount1 = BudgetLineAmount.create(100).getValue();
      const amount2 = BudgetLineAmount.create(50).getValue();

      const result = amount1.add(amount2);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(150);
    });

    it('should subtract two amounts', () => {
      const amount1 = BudgetLineAmount.create(100).getValue();
      const amount2 = BudgetLineAmount.create(30).getValue();

      const result = amount1.subtract(amount2);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(70);
    });

    it('should fail when subtraction results in negative', () => {
      const amount1 = BudgetLineAmount.create(50).getValue();
      const amount2 = BudgetLineAmount.create(100).getValue();

      const result = amount1.subtract(amount2);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_AMOUNT');
    });

    it('should multiply by a factor', () => {
      const amount = BudgetLineAmount.create(100).getValue();

      const result = amount.multiply(1.5);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(150);
    });

    it('should handle multiplication with rounding', () => {
      const amount = BudgetLineAmount.create(100).getValue();

      const result = amount.multiply(1 / 3);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(33.33);
    });
  });

  describe('comparison operations', () => {
    it('should compare equality', () => {
      const amount1 = BudgetLineAmount.create(100).getValue();
      const amount2 = BudgetLineAmount.create(100).getValue();
      const amount3 = BudgetLineAmount.create(150).getValue();

      expect(amount1.equals(amount2)).toBe(true);
      expect(amount1.equals(amount3)).toBe(false);
    });

    it('should compare greater than', () => {
      const amount1 = BudgetLineAmount.create(150).getValue();
      const amount2 = BudgetLineAmount.create(100).getValue();

      expect(amount1.isGreaterThan(amount2)).toBe(true);
      expect(amount2.isGreaterThan(amount1)).toBe(false);
      expect(amount1.isGreaterThan(amount1)).toBe(false);
    });

    it('should compare less than', () => {
      const amount1 = BudgetLineAmount.create(100).getValue();
      const amount2 = BudgetLineAmount.create(150).getValue();

      expect(amount1.isLessThan(amount2)).toBe(true);
      expect(amount2.isLessThan(amount1)).toBe(false);
      expect(amount1.isLessThan(amount1)).toBe(false);
    });

    it('should check if zero', () => {
      const zeroAmount = BudgetLineAmount.create(0).getValue();
      const nonZeroAmount = BudgetLineAmount.create(0.01).getValue();

      expect(zeroAmount.isZero()).toBe(true);
      expect(nonZeroAmount.isZero()).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to string with 2 decimal places', () => {
      const amount1 = BudgetLineAmount.create(100).getValue();
      const amount2 = BudgetLineAmount.create(100.5).getValue();
      const amount3 = BudgetLineAmount.create(100.99).getValue();

      expect(amount1.toString()).toBe('100.00');
      expect(amount2.toString()).toBe('100.50');
      expect(amount3.toString()).toBe('100.99');
    });

    it('should convert to JSON as number', () => {
      const amount = BudgetLineAmount.create(150.75).getValue();

      expect(amount.toJSON()).toBe(150.75);
      expect(typeof amount.toJSON()).toBe('number');
    });
  });
});
