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
