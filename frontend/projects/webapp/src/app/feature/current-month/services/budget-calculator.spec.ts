import { describe, beforeEach, it, expect } from 'vitest';
import { BudgetCalculator } from './budget-calculator';
import { Transaction, TransactionType } from '@pulpe/shared';

describe('BudgetCalculator', () => {
  let calculator: BudgetCalculator;

  beforeEach(() => {
    calculator = new BudgetCalculator();
  });

  const createTransaction = (
    type: TransactionType,
    amount: number,
    name: string = 'Test Transaction',
  ): Transaction => ({
    id: `${type}-${amount}`,
    amount,
    type,
    name,
    description: null,
    budgetId: 'test-budget-id',
    expenseType: 'variable',
    isRecurring: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'test-user',
  });

  describe('calculateTotalIncome', () => {
    it('should calculate total income correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 5000, 'Salary'),
        createTransaction('income', 1000, 'Bonus'),
        createTransaction('expense', 500, 'Rent'), // Should be ignored
        createTransaction('income', 300, 'Freelance'),
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);

      // Assert
      expect(totalIncome).toBe(6300);
    });

    it('should return zero when no income transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('expense', 500, 'Rent'),
        createTransaction('saving', 200, 'Emergency Fund'),
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);

      // Assert
      expect(totalIncome).toBe(0);
    });

    it('should handle empty transactions array', () => {
      // Arrange
      const transactions: Transaction[] = [];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);

      // Assert
      expect(totalIncome).toBe(0);
    });

    it('should handle negative income amounts', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 5000, 'Salary'),
        createTransaction('income', -200, 'Tax Correction'),
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);

      // Assert
      expect(totalIncome).toBe(4800);
    });

    it('should handle decimal amounts correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 3333.33, 'Salary'),
        createTransaction('income', 666.67, 'Bonus'),
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);

      // Assert
      expect(totalIncome).toBeCloseTo(4000, 2);
    });
  });

  describe('calculateTotalExpenses', () => {
    it('should calculate total expenses correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('expense', 1200, 'Rent'),
        createTransaction('expense', 300, 'Groceries'),
        createTransaction('income', 5000, 'Salary'), // Should be ignored
        createTransaction('expense', 150, 'Utilities'),
      ];

      // Act
      const totalExpenses = calculator.calculateTotalExpenses(transactions);

      // Assert
      expect(totalExpenses).toBe(1650);
    });

    it('should return zero when no expense transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 5000, 'Salary'),
        createTransaction('saving', 500, 'Investment'),
      ];

      // Act
      const totalExpenses = calculator.calculateTotalExpenses(transactions);

      // Assert
      expect(totalExpenses).toBe(0);
    });

    it('should handle large expense amounts', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('expense', 999999.99, 'Property Purchase'),
        createTransaction('expense', 0.01, 'Penny Expense'),
      ];

      // Act
      const totalExpenses = calculator.calculateTotalExpenses(transactions);

      // Assert
      expect(totalExpenses).toBe(1000000);
    });
  });

  describe('calculateTotalSavings', () => {
    it('should calculate total savings correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('saving', 500, 'Emergency Fund'),
        createTransaction('saving', 1000, 'Investment'),
        createTransaction('expense', 200, 'Food'), // Should be ignored
        createTransaction('saving', 250, 'Vacation Fund'),
      ];

      // Act
      const totalSavings = calculator.calculateTotalSavings(transactions);

      // Assert
      expect(totalSavings).toBe(1750);
    });

    it('should return zero when no saving transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 5000, 'Salary'),
        createTransaction('expense', 1000, 'Rent'),
      ];

      // Act
      const totalSavings = calculator.calculateTotalSavings(transactions);

      // Assert
      expect(totalSavings).toBe(0);
    });

    it('should handle negative savings (withdrawals)', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('saving', 1000, 'Initial Deposit'),
        createTransaction('saving', -300, 'Emergency Withdrawal'),
        createTransaction('saving', 500, 'Monthly Saving'),
      ];

      // Act
      const totalSavings = calculator.calculateTotalSavings(transactions);

      // Assert
      expect(totalSavings).toBe(1200);
    });
  });

  describe('calculateNegativeBudget', () => {
    it('should return zero when income exceeds expenses', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 5000, 'Salary'),
        createTransaction('expense', 3000, 'Total Expenses'),
      ];

      // Act
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(negativeBudget).toBe(0);
    });

    it('should return negative value when expenses exceed income', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 3000, 'Salary'),
        createTransaction('expense', 4000, 'Total Expenses'),
      ];

      // Act
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(negativeBudget).toBe(-1000);
    });

    it('should return zero when income equals expenses', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 3000, 'Salary'),
        createTransaction('expense', 3000, 'Total Expenses'),
      ];

      // Act
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(negativeBudget).toBe(0);
    });

    it('should ignore savings in negative budget calculation', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 5000, 'Salary'),
        createTransaction('expense', 3000, 'Expenses'),
        createTransaction('saving', 1000, 'Savings'), // Should not affect calculation
      ];

      // Act
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(negativeBudget).toBe(0); // (5000 - 3000) = 2000, Math.min(0, 2000) = 0
    });

    it('should handle edge case with no transactions', () => {
      // Arrange
      const transactions: Transaction[] = [];

      // Act
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(negativeBudget).toBe(0); // Math.min(0, 0 - 0) = 0
    });

    it('should handle complex budget scenarios', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 3500, 'Primary Job'),
        createTransaction('income', 1000, 'Side Hustle'),
        createTransaction('expense', 1200, 'Rent'),
        createTransaction('expense', 800, 'Food'),
        createTransaction('expense', 300, 'Transport'),
        createTransaction('expense', 2500, 'Other Expenses'), // Total expenses: 4800
        createTransaction('saving', 500, 'Should be ignored'),
      ];

      // Act
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      // Total income: 4500, Total expenses: 4800
      // Deficit: 4500 - 4800 = -300
      expect(negativeBudget).toBe(-300);
    });
  });

  describe('Integration Tests', () => {
    it('should calculate all totals consistently from same dataset', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 5000, 'Salary'),
        createTransaction('income', 500, 'Bonus'),
        createTransaction('expense', 1200, 'Rent'),
        createTransaction('expense', 800, 'Food'),
        createTransaction('expense', 300, 'Transport'),
        createTransaction('saving', 1000, 'Emergency Fund'),
        createTransaction('saving', 500, 'Investment'),
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);
      const totalExpenses = calculator.calculateTotalExpenses(transactions);
      const totalSavings = calculator.calculateTotalSavings(transactions);
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(totalIncome).toBe(5500);
      expect(totalExpenses).toBe(2300);
      expect(totalSavings).toBe(1500);
      expect(negativeBudget).toBe(0); // 5500 - 2300 = 3200 > 0

      // Verify budget calculation logic
      const remainingBudget = totalIncome - totalExpenses;
      expect(remainingBudget).toBe(3200);
      expect(Math.min(0, remainingBudget)).toBe(0);
    });

    it('should handle financial stress scenario correctly', () => {
      // Arrange - Simulating overspending scenario
      const transactions: Transaction[] = [
        createTransaction('income', 2500, 'Part-time Job'),
        createTransaction('expense', 1000, 'Rent'),
        createTransaction('expense', 600, 'Food'),
        createTransaction('expense', 400, 'Transport'),
        createTransaction('expense', 300, 'Utilities'),
        createTransaction('expense', 500, 'Unexpected Expense'),
        createTransaction('saving', -200, 'Emergency Withdrawal'),
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);
      const totalExpenses = calculator.calculateTotalExpenses(transactions);
      const totalSavings = calculator.calculateTotalSavings(transactions);
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(totalIncome).toBe(2500);
      expect(totalExpenses).toBe(2800);
      expect(totalSavings).toBe(-200);
      expect(negativeBudget).toBe(-300); // 2500 - 2800 = -300
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero amounts correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction('income', 0, 'No Income'),
        createTransaction('expense', 0, 'No Expense'),
        createTransaction('saving', 0, 'No Saving'),
      ];

      // Act & Assert
      expect(calculator.calculateTotalIncome(transactions)).toBe(0);
      expect(calculator.calculateTotalExpenses(transactions)).toBe(0);
      expect(calculator.calculateTotalSavings(transactions)).toBe(0);
      expect(calculator.calculateNegativeBudget(transactions)).toBe(0);
    });

    it('should handle very large numbers correctly', () => {
      // Arrange
      const largeAmount = Number.MAX_SAFE_INTEGER / 10;
      const transactions: Transaction[] = [
        createTransaction('income', largeAmount, 'Large Income'),
        createTransaction('expense', largeAmount / 2, 'Large Expense'),
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);
      const totalExpenses = calculator.calculateTotalExpenses(transactions);
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert
      expect(totalIncome).toBe(largeAmount);
      expect(totalExpenses).toBe(largeAmount / 2);
      expect(negativeBudget).toBe(0);
    });

    it('should handle precision with floating point arithmetic', () => {
      // Arrange - Numbers that could cause floating point precision issues
      const transactions: Transaction[] = [
        createTransaction('income', 0.1, 'Small Income 1'),
        createTransaction('income', 0.2, 'Small Income 2'),
        createTransaction('expense', 0.3, 'Small Expense'),
      ];

      // Act
      const totalIncome = calculator.calculateTotalIncome(transactions);
      const totalExpenses = calculator.calculateTotalExpenses(transactions);
      const negativeBudget = calculator.calculateNegativeBudget(transactions);

      // Assert - Use toBeCloseTo for floating point comparisons
      expect(totalIncome).toBeCloseTo(0.3, 10);
      expect(totalExpenses).toBeCloseTo(0.3, 10);
      expect(negativeBudget).toBeCloseTo(0, 10);
    });
  });
});
