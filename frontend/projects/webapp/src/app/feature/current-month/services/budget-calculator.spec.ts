import { describe, beforeEach, it, expect } from 'vitest';
import { BudgetCalculator } from './budget-calculator';
import { Transaction } from '@pulpe/shared';

describe('BudgetCalculator', () => {
  let calculator: BudgetCalculator;

  beforeEach(() => {
    calculator = new BudgetCalculator();
  });

  const createTransaction = (
    amount: number,
    name = 'Test Transaction',
    kind: 'INCOME' | 'FIXED_EXPENSE' | 'SAVINGS_CONTRIBUTION' = 'FIXED_EXPENSE',
  ): Transaction => ({
    id: `transaction-${amount}`,
    amount,
    name,
    kind,
    budgetId: 'test-budget-id',
    transactionDate: new Date().toISOString(),
    isOutOfBudget: false,
    category: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  describe('calculateTotalIncome', () => {
    it('should calculate total for income transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(5000, 'Payment', 'INCOME'),
        createTransaction(1000, 'Refund', 'INCOME'),
        createTransaction(300, 'Gift', 'INCOME'),
        createTransaction(500, 'Expense', 'FIXED_EXPENSE'), // Should be ignored
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);

      // Assert
      expect(totalIncome).toBe(6300);
    });

    it('should return zero with empty transactions array', () => {
      // Arrange
      const transactions: Transaction[] = [];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);

      // Assert
      expect(totalIncome).toBe(0);
    });
  });

  describe('calculateTotalExpenses', () => {
    it('should calculate total expenses correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(1000, 'Rent', 'FIXED_EXPENSE'),
        createTransaction(200, 'Groceries', 'FIXED_EXPENSE'),
        createTransaction(450, 'Insurance', 'FIXED_EXPENSE'),
        createTransaction(5000, 'Income', 'INCOME'), // Should be ignored
      ];

      // Act
      const totalExpenses = calculator.calculateTotalExpenses(transactions);

      // Assert
      expect(totalExpenses).toBe(1650);
    });

    it('should return zero when no transactions', () => {
      // Arrange
      const transactions: Transaction[] = [];

      // Act
      const totalExpenses = calculator.calculateTotalExpenses(transactions);

      // Assert
      expect(totalExpenses).toBe(0);
    });

    it('should handle large expense amounts', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(50000, 'Car', 'FIXED_EXPENSE'),
        createTransaction(10000, 'Vacation', 'FIXED_EXPENSE'),
      ];

      // Act
      const totalExpenses = calculator.calculateTotalExpenses(transactions);

      // Assert
      expect(totalExpenses).toBe(60000);
    });
  });

  describe('calculateTotalSavings', () => {
    it('should calculate total for savings transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(500, 'Transfer to savings', 'SAVINGS_CONTRIBUTION'),
        createTransaction(1000, 'Investment', 'SAVINGS_CONTRIBUTION'),
        createTransaction(200, 'Expense', 'FIXED_EXPENSE'), // Should be ignored
      ];

      // Act
      const totalSavings = calculator.calculateTotalSavings(transactions);

      // Assert
      expect(totalSavings).toBe(1500);
    });

    it('should return zero with empty transactions array', () => {
      // Arrange
      const transactions: Transaction[] = [];

      // Act
      const totalSavings = calculator.calculateTotalSavings(transactions);

      // Assert
      expect(totalSavings).toBe(0);
    });
  });

  describe('calculateNegativeBudget', () => {
    it('should calculate negative budget correctly with mixed transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(5000, 'Salary', 'INCOME'),
        createTransaction(3000, 'Rent', 'FIXED_EXPENSE'),
        createTransaction(1000, 'Food', 'FIXED_EXPENSE'),
        createTransaction(500, 'Transport', 'FIXED_EXPENSE'),
        createTransaction(1000, 'Savings', 'SAVINGS_CONTRIBUTION'),
      ];

      // Act
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      // Income: 5000, Expenses: 4500, Savings: 1000
      // 5000 - 4500 - 1000 = -500
      expect(negativeBudget).toBe(-500);
    });

    it('should return zero when no transactions', () => {
      // Arrange
      const transactions: Transaction[] = [];

      // Act
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(negativeBudget).toBe(0);
    });

    it('should handle single expense transaction', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(1000, 'Expense', 'FIXED_EXPENSE'),
      ];

      // Act
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(negativeBudget).toBe(-1000);
    });
  });

  describe('Integration Tests', () => {
    it('should calculate all totals consistently from same dataset', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(2000, 'Rent'),
        createTransaction(800, 'Groceries'),
        createTransaction(400, 'Utilities'),
        createTransaction(300, 'Entertainment'),
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);
      const totalExpenses = calculator.calculateTotalExpenses(transactions);
      const totalSavings = calculator.calculateTotalSavings(transactions);
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(totalIncome).toBe(0); // All transactions are expenses
      expect(totalExpenses).toBe(3500);
      expect(totalSavings).toBe(0); // No savings transactions
      expect(negativeBudget).toBe(-3500);
    });

    it('should handle empty transactions consistently', () => {
      // Arrange
      const transactions: Transaction[] = [];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);
      const totalExpenses = calculator.calculateTotalExpenses(transactions);
      const totalSavings = calculator.calculateTotalSavings(transactions);
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(totalIncome).toBe(0);
      expect(totalExpenses).toBe(0);
      expect(totalSavings).toBe(0);
      expect(negativeBudget).toBe(0);
    });
  });

  describe('calculateUsedPercentage', () => {
    it('should calculate percentage correctly for normal values', () => {
      expect(calculator.calculateUsedPercentage(1000, 250)).toBe(25);
      expect(calculator.calculateUsedPercentage(1000, 500)).toBe(50);
      expect(calculator.calculateUsedPercentage(1000, 750)).toBe(75);
      expect(calculator.calculateUsedPercentage(1000, 1000)).toBe(100);
    });

    it('should handle decimal values correctly', () => {
      expect(calculator.calculateUsedPercentage(1000, 333.33)).toBeCloseTo(
        33.333,
        2,
      );
      expect(calculator.calculateUsedPercentage(1500.5, 750.25)).toBeCloseTo(
        50,
        2,
      );
    });

    it('should return 0 when totalBudget is 0', () => {
      expect(calculator.calculateUsedPercentage(0, 100)).toBe(0);
      expect(calculator.calculateUsedPercentage(0, 0)).toBe(0);
    });

    it('should return 0 when totalBudget is negative', () => {
      expect(calculator.calculateUsedPercentage(-1000, 500)).toBe(0);
      expect(calculator.calculateUsedPercentage(-100, -50)).toBe(0);
    });

    it('should return 0 when usedAmount is negative', () => {
      expect(calculator.calculateUsedPercentage(1000, -100)).toBe(0);
    });

    it('should return 0 when usedAmount is 0', () => {
      expect(calculator.calculateUsedPercentage(1000, 0)).toBe(0);
    });

    it('should cap at 100% when usedAmount exceeds totalBudget', () => {
      expect(calculator.calculateUsedPercentage(1000, 1500)).toBe(100);
      expect(calculator.calculateUsedPercentage(1000, 2000)).toBe(100);
    });

    it('should handle null and undefined values', () => {
      expect(
        calculator.calculateUsedPercentage(null as unknown as number, 100),
      ).toBe(0);
      expect(
        calculator.calculateUsedPercentage(undefined as unknown as number, 100),
      ).toBe(0);
      expect(
        calculator.calculateUsedPercentage(1000, null as unknown as number),
      ).toBe(0);
      expect(
        calculator.calculateUsedPercentage(
          1000,
          undefined as unknown as number,
        ),
      ).toBe(0);
    });

    it('should handle NaN values', () => {
      expect(calculator.calculateUsedPercentage(NaN, 100)).toBe(0);
      expect(calculator.calculateUsedPercentage(1000, NaN)).toBe(0);
      expect(calculator.calculateUsedPercentage(NaN, NaN)).toBe(0);
    });

    it('should handle very large numbers', () => {
      const largeNumber = Number.MAX_SAFE_INTEGER;
      expect(
        calculator.calculateUsedPercentage(largeNumber, largeNumber / 2),
      ).toBe(50);
      expect(calculator.calculateUsedPercentage(largeNumber, largeNumber)).toBe(
        100,
      );
    });

    it('should handle very small numbers', () => {
      expect(calculator.calculateUsedPercentage(0.01, 0.005)).toBe(50);
      expect(calculator.calculateUsedPercentage(0.001, 0.0001)).toBe(10);
    });
  });

  describe('calculateRemainingAmount', () => {
    it('should calculate remaining amount correctly for normal values', () => {
      expect(calculator.calculateRemainingAmount(1000, 250)).toBe(750);
      expect(calculator.calculateRemainingAmount(1000, 500)).toBe(500);
      expect(calculator.calculateRemainingAmount(1000, 750)).toBe(250);
      expect(calculator.calculateRemainingAmount(1000, 1000)).toBe(0);
    });

    it('should return totalBudget when usedAmount is 0', () => {
      expect(calculator.calculateRemainingAmount(1000, 0)).toBe(1000);
    });

    it('should return totalBudget when usedAmount is negative', () => {
      expect(calculator.calculateRemainingAmount(1000, -100)).toBe(1000);
    });

    it('should return 0 when totalBudget is 0', () => {
      expect(calculator.calculateRemainingAmount(0, 100)).toBe(0);
      expect(calculator.calculateRemainingAmount(0, 0)).toBe(0);
    });

    it('should return 0 when totalBudget is negative', () => {
      expect(calculator.calculateRemainingAmount(-1000, 500)).toBe(0);
    });

    it('should return 0 when usedAmount exceeds totalBudget', () => {
      expect(calculator.calculateRemainingAmount(1000, 1500)).toBe(0);
      expect(calculator.calculateRemainingAmount(1000, 2000)).toBe(0);
    });

    it('should handle null and undefined values', () => {
      expect(
        calculator.calculateRemainingAmount(null as unknown as number, 100),
      ).toBe(0);
      expect(
        calculator.calculateRemainingAmount(
          undefined as unknown as number,
          100,
        ),
      ).toBe(0);
      expect(
        calculator.calculateRemainingAmount(1000, null as unknown as number),
      ).toBe(1000);
      expect(
        calculator.calculateRemainingAmount(
          1000,
          undefined as unknown as number,
        ),
      ).toBe(1000);
    });

    it('should handle decimal values', () => {
      expect(calculator.calculateRemainingAmount(1000.5, 250.25)).toBeCloseTo(
        750.25,
        2,
      );
      expect(calculator.calculateRemainingAmount(999.99, 333.33)).toBeCloseTo(
        666.66,
        2,
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero amounts correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(0, 'Zero transaction', 'FIXED_EXPENSE'),
        createTransaction(1000, 'Normal transaction', 'FIXED_EXPENSE'),
      ];

      // Act
      const totalExpenses = calculator.calculateTotalExpenses(transactions);
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(totalExpenses).toBe(1000);
      expect(negativeBudget).toBe(-1000);
    });

    it('should handle very large numbers correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(
          1000000000,
          'Billion dollar expense',
          'FIXED_EXPENSE',
        ),
        createTransaction(999999999, 'Almost billion', 'FIXED_EXPENSE'),
      ];

      // Act
      const totalExpenses = calculator.calculateTotalExpenses(transactions);

      // Assert
      expect(totalExpenses).toBe(1999999999);
    });

    it('should handle precision with floating point arithmetic', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(0.1, 'Small expense 1', 'FIXED_EXPENSE'),
        createTransaction(0.1, 'Small expense 2', 'FIXED_EXPENSE'),
        createTransaction(0.1, 'Small expense 3', 'FIXED_EXPENSE'),
      ];

      // Act
      const totalExpenses = calculator.calculateTotalExpenses(transactions);

      // Assert - Use toBeCloseTo for floating point comparisons
      expect(totalExpenses).toBeCloseTo(0.3, 10);
    });
  });
});
