import { describe, beforeEach, it, expect } from 'vitest';
import { BudgetCalculator } from './budget-calculator';
import { type Transaction, type BudgetLine } from '@pulpe/shared';

describe('BudgetCalculator', () => {
  let calculator: BudgetCalculator;

  beforeEach(() => {
    calculator = new BudgetCalculator();
  });

  const createTransaction = (
    amount: number,
    name = 'Test Transaction',
    kind: 'income' | 'expense' | 'saving' = 'expense',
    id = `transaction-${amount}-${kind}`,
  ): Transaction => ({
    id,
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

  // Helper function to create mock BudgetLine objects
  const createBudgetLine = (
    amount: number,
    name: string,
    kind: 'income' | 'expense' | 'saving',
    id = `budget-line-${amount}-${kind}-${Math.random()}`,
  ): BudgetLine => ({
    id,
    budgetId: 'test-budget-id',
    templateLineId: 'test-template-id',
    savingsGoalId: null,
    name,
    amount,
    kind,
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  describe('calculateFixedBlock', () => {
    it('should calculate fixed block correctly for expenses only', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(2200, 'Housing Costs', 'expense'),
        createBudgetLine(450, 'Health Insurance', 'expense'),
        createBudgetLine(150, 'Phone Plan', 'expense'),
        createBudgetLine(8000, 'Monthly Income', 'income'), // Should be ignored
      ];

      // Act
      const fixedBlock = calculator.calculateFixedBlock(budgetLines);

      // Assert
      expect(fixedBlock).toBe(2800);
    });

    it('should calculate fixed block correctly for expenses and savings', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(2200, 'Housing Costs', 'expense'),
        createBudgetLine(450, 'Health Insurance', 'expense'),
        createBudgetLine(500, 'Emergency Fund', 'saving'),
        createBudgetLine(1200, 'House Goal', 'saving'),
        createBudgetLine(8000, 'Monthly Income', 'income'), // Should be ignored
      ];

      // Act
      const fixedBlock = calculator.calculateFixedBlock(budgetLines);

      // Assert
      expect(fixedBlock).toBe(4350); // 2200 + 450 + 500 + 1200
    });

    it('should return 0 for empty budget lines', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [];

      // Act
      const fixedBlock = calculator.calculateFixedBlock(budgetLines);

      // Assert
      expect(fixedBlock).toBe(0);
    });

    it('should return 0 when no relevant budget lines exist', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(8000, 'Monthly Income', 'income'),
        createBudgetLine(200, 'Freelance', 'income'),
      ];

      // Act
      const fixedBlock = calculator.calculateFixedBlock(budgetLines);

      // Assert
      expect(fixedBlock).toBe(0);
    });
  });

  describe('calculatePlannedIncome', () => {
    it('should calculate planned income correctly', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(8000, 'Monthly Income', 'income'),
        createBudgetLine(200, 'Freelance', 'income'),
        createBudgetLine(2200, 'Housing Costs', 'expense'), // Should be ignored
        createBudgetLine(500, 'Emergency Fund', 'saving'), // Should be ignored
      ];

      // Act
      const plannedIncome = calculator.calculatePlannedIncome(budgetLines);

      // Assert
      expect(plannedIncome).toBe(8200); // 8000 + 200
    });

    it('should return 0 for empty budget lines', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [];

      // Act
      const plannedIncome = calculator.calculatePlannedIncome(budgetLines);

      // Assert
      expect(plannedIncome).toBe(0);
    });

    it('should return 0 when no income lines exist', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(2200, 'Housing Costs', 'expense'),
        createBudgetLine(500, 'Emergency Fund', 'saving'),
      ];

      // Act
      const plannedIncome = calculator.calculatePlannedIncome(budgetLines);

      // Assert
      expect(plannedIncome).toBe(0);
    });
  });

  describe('calculateLivingAllowance', () => {
    it('should calculate living allowance correctly', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(8000, 'Monthly Income', 'income'),
        createBudgetLine(2200, 'Housing Costs', 'expense'),
        createBudgetLine(450, 'Health Insurance', 'expense'),
        createBudgetLine(150, 'Phone Plan', 'expense'),
        createBudgetLine(1137, 'Leasing/Credit', 'expense'),
        createBudgetLine(500, 'Emergency Fund', 'saving'),
      ];

      // Act
      const livingAllowance = calculator.calculateLivingAllowance(budgetLines);

      // Assert
      expect(livingAllowance).toBe(3563); // 8000 - (2200 + 450 + 150 + 1137 + 500)
    });

    it('should handle negative living allowance', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(5000, 'Monthly Income', 'income'),
        createBudgetLine(6000, 'Expensive Housing', 'expense'),
        createBudgetLine(1000, 'Savings', 'saving'),
      ];

      // Act
      const livingAllowance = calculator.calculateLivingAllowance(budgetLines);

      // Assert
      expect(livingAllowance).toBe(-2000); // 5000 - (6000 + 1000)
    });

    it('should return 0 for empty budget lines', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [];

      // Act
      const livingAllowance = calculator.calculateLivingAllowance(budgetLines);

      // Assert
      expect(livingAllowance).toBe(0);
    });
  });

  describe('calculateActualTransactionsAmount', () => {
    it('should calculate actual transactions impact on Living Allowance correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(30, 'Restaurant', 'expense'),
        createTransaction(50, 'Groceries', 'expense'),
        createTransaction(25, 'Coffee', 'expense'),
        createTransaction(1000, 'Freelance Income', 'income'),
        createTransaction(200, 'Extra Savings', 'saving'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      // Income (+1000) - Expenses (-30 -50 -25) - Savings (-200) = +695
      expect(actualTransactions).toBe(695);
    });

    it('should handle negative impact (more spent than received)', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(500, 'Expenses', 'expense'),
        createTransaction(200, 'More expenses', 'expense'),
        createTransaction(100, 'Small income', 'income'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      // Income (+100) - Expenses (-500 -200) = -600
      expect(actualTransactions).toBe(-600);
    });

    it('should return 0 for empty transactions', () => {
      // Arrange
      const transactions: Transaction[] = [];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(0);
    });

    it('should handle only income transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(1000, 'Salary', 'income'),
        createTransaction(200, 'Bonus', 'income'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(1200);
    });

    it('should handle only expense transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(100, 'Food', 'expense'),
        createTransaction(50, 'Transport', 'expense'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(-150);
    });

    it('should handle only saving transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(200, 'Emergency Fund', 'saving'),
        createTransaction(300, 'House Fund', 'saving'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(-500);
    });
  });

  describe('composeBudgetItemsWithBalanceGrouped', () => {
    it('should group budget lines by recurrence and sort according to business rules', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        {
          ...createBudgetLine(2000, 'Rent', 'expense', 'bl-expense-fixed'),
          recurrence: 'fixed',
        },
        {
          ...createBudgetLine(6000, 'Salary', 'income', 'bl-income-fixed'),
          recurrence: 'fixed',
        },
        {
          ...createBudgetLine(
            500,
            'Emergency Fund',
            'saving',
            'bl-saving-fixed',
          ),
          recurrence: 'fixed',
        },
        {
          ...createBudgetLine(200, 'Bonus', 'income', 'bl-income-one-off'),
          recurrence: 'one_off',
        },
        {
          ...createBudgetLine(
            100,
            'Gift Money',
            'expense',
            'bl-expense-one-off',
          ),
          recurrence: 'one_off',
        },
      ];

      const transactions: Transaction[] = [
        createTransaction(50, 'Groceries', 'expense', 'tx-expense-1'),
        createTransaction(300, 'Side Job', 'income', 'tx-income-1'),
      ];

      // Act
      const result = calculator.composeBudgetItemsWithBalanceGrouped(
        budgetLines,
        transactions,
      );

      // Assert
      expect(result).toHaveLength(7);

      // Check grouped order:
      // 1. Fixed budget lines (income → saving → expense)
      // 2. One-off budget lines (income → expense)
      // 3. Transactions (income → expense)
      const expectedOrder = [
        'bl-income-fixed', // Fixed income
        'bl-saving-fixed', // Fixed saving
        'bl-expense-fixed', // Fixed expense
        'bl-income-one-off', // One-off income
        'bl-expense-one-off', // One-off expense
        'tx-income-1', // Transaction income
        'tx-expense-1', // Transaction expense
      ];

      result.forEach((item, index) => {
        expect(item.item.id).toBe(expectedOrder[index]);
      });
    });

    it('should handle mixed recurrence types and calculate cumulative balance correctly', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        {
          ...createBudgetLine(5000, 'Monthly Salary', 'income'),
          recurrence: 'fixed',
        },
        {
          ...createBudgetLine(1000, 'Monthly Savings', 'saving'),
          recurrence: 'fixed',
        },
        {
          ...createBudgetLine(500, 'One-time Bonus', 'income'),
          recurrence: 'one_off',
        },
        {
          ...createBudgetLine(200, 'Gift Purchase', 'expense'),
          recurrence: 'one_off',
        },
      ];

      const transactions: Transaction[] = [
        createTransaction(100, 'Extra Income', 'income'),
        createTransaction(300, 'Unexpected Expense', 'expense'),
      ];

      // Act
      const result = calculator.composeBudgetItemsWithBalanceGrouped(
        budgetLines,
        transactions,
      );

      // Assert
      const balances = result.map((item) => item.cumulativeBalance);

      // Expected progression:
      // Fixed: 5000 (income) - 1000 (saving) = 4000
      // One-off: 4000 + 500 (income) - 200 (expense) = 4300
      // Transactions: 4300 + 100 (income) - 300 (expense) = 4100
      expect(balances).toEqual([5000, 4000, 4500, 4300, 4400, 4100]);
    });

    it('should handle empty recurrence groups correctly', () => {
      // Arrange - only one_off budget lines
      const budgetLines: BudgetLine[] = [
        {
          ...createBudgetLine(1000, 'One-time Income', 'income'),
          recurrence: 'one_off',
        },
        {
          ...createBudgetLine(300, 'One-time Expense', 'expense'),
          recurrence: 'one_off',
        },
      ];

      const transactions: Transaction[] = [
        createTransaction(200, 'Transaction Income', 'income'),
      ];

      // Act
      const result = calculator.composeBudgetItemsWithBalanceGrouped(
        budgetLines,
        transactions,
      );

      // Assert
      expect(result).toHaveLength(3);

      // Should be: one-off income, one-off expense, transaction income
      const ids = result.map((item) => item.item.id);
      expect(ids[0]).toContain('income');
      expect(ids[1]).toContain('expense');
      expect(ids[2]).toContain('income');

      // Check item types
      expect(result[0].itemType).toBe('budget_line');
      expect(result[1].itemType).toBe('budget_line');
      expect(result[2].itemType).toBe('transaction');
    });

    it('should treat variable recurrence as fixed for grouping', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        {
          ...createBudgetLine(3000, 'Variable Income', 'income'),
          recurrence: 'variable',
        },
        {
          ...createBudgetLine(2000, 'Fixed Expense', 'expense'),
          recurrence: 'fixed',
        },
      ];

      // Act
      const result = calculator.composeBudgetItemsWithBalanceGrouped(
        budgetLines,
        [],
      );

      // Assert - variable should be grouped with fixed (come first)
      expect(result).toHaveLength(2);
      expect(result[0].item.kind).toBe('income'); // Variable income comes first
      expect(result[1].item.kind).toBe('expense'); // Fixed expense comes second
    });
  });
});
