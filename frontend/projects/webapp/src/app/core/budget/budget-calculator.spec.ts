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

  describe('composeBudgetItemsWithBalance', () => {
    it('should combine and sort items according to business rules', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(2000, 'Rent', 'expense', 'bl-expense-1'),
        createBudgetLine(6000, 'Salary', 'income', 'bl-income-1'),
        createBudgetLine(500, 'Emergency Fund', 'saving', 'bl-saving-1'),
        createBudgetLine(200, 'Freelance', 'income', 'bl-income-2'),
      ];

      const transactions: Transaction[] = [
        createTransaction(50, 'Groceries', 'expense', 'tx-expense-1'),
        createTransaction(300, 'Side Job', 'income', 'tx-income-1'),
        createTransaction(100, 'Extra Savings', 'saving', 'tx-saving-1'),
      ];

      // Act
      const result = calculator.composeBudgetItemsWithBalance(
        budgetLines,
        transactions,
      );

      // Assert
      expect(result).toHaveLength(7);

      // Check order: income (budget lines first), then savings, then expenses
      const expectedOrder = [
        'bl-income-1', // Salary (budget line)
        'bl-income-2', // Freelance (budget line)
        'tx-income-1', // Side Job (transaction)
        'bl-saving-1', // Emergency Fund (budget line)
        'tx-saving-1', // Extra Savings (transaction)
        'bl-expense-1', // Rent (budget line)
        'tx-expense-1', // Groceries (transaction)
      ];

      result.forEach((item, index) => {
        expect(item.item.id).toBe(expectedOrder[index]);
      });
    });

    it('should calculate cumulative balance correctly', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(5000, 'Salary', 'income', 'income-1'),
        createBudgetLine(1000, 'Savings', 'saving', 'saving-1'),
        createBudgetLine(2000, 'Rent', 'expense', 'expense-1'),
      ];

      const transactions: Transaction[] = [
        createTransaction(100, 'Bonus', 'income', 'tx-income-1'),
        createTransaction(200, 'Food', 'expense', 'tx-expense-1'),
      ];

      // Act
      const result = calculator.composeBudgetItemsWithBalance(
        budgetLines,
        transactions,
      );

      // Assert
      const balances = result.map((item) => item.cumulativeBalance);

      // Expected progression:
      // 0 + 5000 (income) = 5000
      // 5000 + 100 (tx income) = 5100
      // 5100 - 1000 (saving) = 4100
      // 4100 - 2000 (expense) = 2100
      // 2100 - 200 (tx expense) = 1900
      expect(balances).toEqual([5000, 5100, 4100, 2100, 1900]);
    });

    it('should handle negative balances correctly', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(1000, 'Small Income', 'income', 'income-1'),
        createBudgetLine(2000, 'Big Expense', 'expense', 'expense-1'),
      ];

      const transactions: Transaction[] = [
        createTransaction(500, 'More Expense', 'expense', 'tx-expense-1'),
      ];

      // Act
      const result = calculator.composeBudgetItemsWithBalance(
        budgetLines,
        transactions,
      );

      // Assert
      const balances = result.map((item) => item.cumulativeBalance);

      // Expected: +1000, -1000, -1500
      expect(balances).toEqual([1000, -1000, -1500]);
    });

    it('should handle empty inputs', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [];
      const transactions: Transaction[] = [];

      // Act
      const result = calculator.composeBudgetItemsWithBalance(
        budgetLines,
        transactions,
      );

      // Assert
      expect(result).toEqual([]);
    });

    it('should set correct item types', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(1000, 'Salary', 'income', 'bl-1'),
      ];
      const transactions: Transaction[] = [
        createTransaction(100, 'Bonus', 'income', 'tx-1'),
      ];

      // Act
      const result = calculator.composeBudgetItemsWithBalance(
        budgetLines,
        transactions,
      );

      // Assert
      expect(result[0].itemType).toBe('budget_line');
      expect(result[1].itemType).toBe('transaction');
    });

    it('should handle complex mixed scenario', () => {
      // Arrange - Real-world scenario
      const budgetLines: BudgetLine[] = [
        createBudgetLine(6000, 'Salary', 'income', 'salary'),
        createBudgetLine(200, 'Freelance', 'income', 'freelance'),
        createBudgetLine(500, 'Emergency Fund', 'saving', 'emergency'),
        createBudgetLine(1200, 'House Goal', 'saving', 'house'),
        createBudgetLine(2000, 'Rent', 'expense', 'rent'),
        createBudgetLine(300, 'Insurance', 'expense', 'insurance'),
      ];

      const transactions: Transaction[] = [
        createTransaction(50, 'Coffee', 'expense', 'coffee'),
        createTransaction(150, 'Groceries', 'expense', 'groceries'),
        createTransaction(100, 'Side Gig', 'income', 'side-gig'),
      ];

      // Act
      const result = calculator.composeBudgetItemsWithBalance(
        budgetLines,
        transactions,
      );

      // Assert
      expect(result).toHaveLength(9);

      // Check final balance calculation
      // Income: 6000 + 200 + 100 = 6300
      // Savings: 500 + 1200 = 1700
      // Expenses: 2000 + 300 + 50 + 150 = 2500
      // Final balance: 6300 - 1700 - 2500 = 2100
      const finalBalance = result[result.length - 1].cumulativeBalance;
      expect(finalBalance).toBe(2100);

      // Verify order maintains business rules
      const kinds = result.map((item) => item.item.kind);
      const incomeCount = kinds.filter((k) => k === 'income').length;
      const savingCount = kinds.filter((k) => k === 'saving').length;
      const expenseCount = kinds.filter((k) => k === 'expense').length;

      expect(incomeCount).toBe(3);
      expect(savingCount).toBe(2);
      expect(expenseCount).toBe(4);

      // Income should come first, then savings, then expenses
      expect(kinds.slice(0, 3).every((k) => k === 'income')).toBe(true);
      expect(kinds.slice(3, 5).every((k) => k === 'saving')).toBe(true);
      expect(kinds.slice(5, 9).every((k) => k === 'expense')).toBe(true);
    });
  });
});
