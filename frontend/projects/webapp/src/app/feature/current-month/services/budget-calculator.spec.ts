import { describe, beforeEach, it, expect } from 'vitest';
import { BudgetCalculator } from './budget-calculator';
import { Transaction, BudgetLine } from '@pulpe/shared';

describe('BudgetCalculator', () => {
  let calculator: BudgetCalculator;

  beforeEach(() => {
    calculator = new BudgetCalculator();
  });

  const createTransaction = (
    amount: number,
    name = 'Test Transaction',
    kind: 'income' | 'expense' | 'saving' = 'expense',
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

  // Helper function to create mock BudgetLine objects
  const createBudgetLine = (
    amount: number,
    name: string,
    kind: 'income' | 'expense' | 'saving',
    id = `budget-line-${Date.now()}-${Math.random()}`,
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
    it('should calculate actual transactions amount correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(30, 'Repas restaurant', 'expense'),
        createTransaction(50, 'Groceries', 'expense'),
        createTransaction(25, 'Coffee', 'expense'),
        createTransaction(1000, 'Salary', 'income'), // Should be ignored
        createTransaction(500, 'Savings', 'saving'), // Should be ignored
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(105); // 30 + 50 + 25
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

    it('should return 0 when no expense transactions exist', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(1000, 'Salary', 'income'),
        createTransaction(500, 'Savings', 'saving'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(0);
    });
  });

  describe('calculateRemainingBudget', () => {
    it('should calculate remaining budget correctly', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(8000, 'Monthly Income', 'income'),
        createBudgetLine(2200, 'Housing Costs', 'expense'),
        createBudgetLine(450, 'Health Insurance', 'expense'),
        createBudgetLine(150, 'Phone Plan', 'expense'),
        createBudgetLine(1137, 'Leasing/Credit', 'expense'),
      ];

      const transactions: Transaction[] = [
        createTransaction(30, 'Repas restaurant', 'expense'),
        createTransaction(50, 'Groceries', 'expense'),
      ];

      // Act
      const remainingBudget = calculator.calculateRemainingBudget(
        budgetLines,
        transactions,
      );

      // Assert
      // Living Allowance = 8000 - (2200 + 450 + 150 + 1137) = 4063
      // Actual Transactions = 30 + 50 = 80
      // Remaining Budget = 4063 - 80 = 3983
      expect(remainingBudget).toBe(3983);
    });

    it('should handle negative remaining budget', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(1000, 'Monthly Income', 'income'),
        createBudgetLine(900, 'Fixed Costs', 'expense'),
      ];

      const transactions: Transaction[] = [
        createTransaction(200, 'Overspending', 'expense'),
      ];

      // Act
      const remainingBudget = calculator.calculateRemainingBudget(
        budgetLines,
        transactions,
      );

      // Assert
      // Living Allowance = 1000 - 900 = 100
      // Actual Transactions = 200
      // Remaining Budget = 100 - 200 = -100
      expect(remainingBudget).toBe(-100);
    });

    it('should return 0 for empty budget lines and transactions', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [];
      const transactions: Transaction[] = [];

      // Act
      const remainingBudget = calculator.calculateRemainingBudget(
        budgetLines,
        transactions,
      );

      // Assert
      expect(remainingBudget).toBe(0);
    });

    it('should match the provided data example', () => {
      // Arrange - Using the exact data from the user's JSON
      const budgetLines: BudgetLine[] = [
        createBudgetLine(8000, 'Monthly Income', 'income'),
        createBudgetLine(2200, 'Housing Costs', 'expense'),
        createBudgetLine(450, 'Health Insurance', 'expense'),
        createBudgetLine(150, 'Phone Plan', 'expense'),
        createBudgetLine(1137, 'Leasing/Credit', 'expense'),
      ];

      const transactions: Transaction[] = [
        createTransaction(30, 'Repas restaurant', 'expense'),
      ];

      // Act
      const plannedIncome = calculator.calculatePlannedIncome(budgetLines);
      const fixedBlock = calculator.calculateFixedBlock(budgetLines);
      const livingAllowance = calculator.calculateLivingAllowance(budgetLines);
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);
      const remainingBudget = calculator.calculateRemainingBudget(
        budgetLines,
        transactions,
      );

      // Assert
      expect(plannedIncome).toBe(8000);
      expect(fixedBlock).toBe(3937); // 2200 + 450 + 150 + 1137
      expect(livingAllowance).toBe(4063); // 8000 - 3937
      expect(actualTransactions).toBe(30);
      expect(remainingBudget).toBe(4033); // 4063 - 30
    });
  });
});
