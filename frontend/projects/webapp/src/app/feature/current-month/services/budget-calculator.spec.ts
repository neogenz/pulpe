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

  // Helper function to create mock BudgetLine objects
  const createBudgetLine = (
    amount: number,
    name: string,
    kind: 'INCOME' | 'FIXED_EXPENSE' | 'SAVINGS_CONTRIBUTION',
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

  describe('calculateUsedPercentage', () => {
    it('should calculate percentage correctly for normal values', () => {
      expect(calculator.calculateUsedPercentage(1000, 250)).toBe(25);
      expect(calculator.calculateUsedPercentage(1000, 500)).toBe(50);
      expect(calculator.calculateUsedPercentage(1000, 750)).toBe(75);
      expect(calculator.calculateUsedPercentage(1000, 1000)).toBe(100);
    });

    it('should return 0 when totalBudget is 0', () => {
      expect(calculator.calculateUsedPercentage(0, 100)).toBe(0);
      expect(calculator.calculateUsedPercentage(0, 0)).toBe(0);
    });

    it('should return 0 when totalBudget is negative', () => {
      expect(calculator.calculateUsedPercentage(-1000, 500)).toBe(0);
    });

    it('should return 0 when usedAmount is 0', () => {
      expect(calculator.calculateUsedPercentage(1000, 0)).toBe(0);
    });

    it('should return 0 when usedAmount is negative', () => {
      expect(calculator.calculateUsedPercentage(1000, -100)).toBe(0);
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
      expect(calculator.calculateRemainingAmount(100.5, 50.25)).toBeCloseTo(
        50.25,
        2,
      );
      expect(calculator.calculateRemainingAmount(1000.75, 250.5)).toBeCloseTo(
        750.25,
        2,
      );
      expect(calculator.calculateRemainingAmount(999.99, 333.33)).toBeCloseTo(
        666.66,
        2,
      );
    });
  });

  describe('calculateFixedBlock', () => {
    it('should calculate fixed block correctly for expenses only', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(2200, 'Housing Costs', 'FIXED_EXPENSE'),
        createBudgetLine(450, 'Health Insurance', 'FIXED_EXPENSE'),
        createBudgetLine(150, 'Phone Plan', 'FIXED_EXPENSE'),
        createBudgetLine(8000, 'Monthly Income', 'INCOME'), // Should be ignored
      ];

      // Act
      const fixedBlock = calculator.calculateFixedBlock(budgetLines);

      // Assert
      expect(fixedBlock).toBe(2800);
    });

    it('should calculate fixed block correctly for expenses and savings', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(2200, 'Housing Costs', 'FIXED_EXPENSE'),
        createBudgetLine(450, 'Health Insurance', 'FIXED_EXPENSE'),
        createBudgetLine(500, 'Emergency Fund', 'SAVINGS_CONTRIBUTION'),
        createBudgetLine(1200, 'House Goal', 'SAVINGS_CONTRIBUTION'),
        createBudgetLine(8000, 'Monthly Income', 'INCOME'), // Should be ignored
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
        createBudgetLine(8000, 'Monthly Income', 'INCOME'),
        createBudgetLine(200, 'Freelance', 'INCOME'),
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
        createBudgetLine(8000, 'Monthly Income', 'INCOME'),
        createBudgetLine(200, 'Freelance', 'INCOME'),
        createBudgetLine(2200, 'Housing Costs', 'FIXED_EXPENSE'), // Should be ignored
        createBudgetLine(500, 'Emergency Fund', 'SAVINGS_CONTRIBUTION'), // Should be ignored
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
        createBudgetLine(2200, 'Housing Costs', 'FIXED_EXPENSE'),
        createBudgetLine(500, 'Emergency Fund', 'SAVINGS_CONTRIBUTION'),
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
        createBudgetLine(8000, 'Monthly Income', 'INCOME'),
        createBudgetLine(2200, 'Housing Costs', 'FIXED_EXPENSE'),
        createBudgetLine(450, 'Health Insurance', 'FIXED_EXPENSE'),
        createBudgetLine(150, 'Phone Plan', 'FIXED_EXPENSE'),
        createBudgetLine(1137, 'Leasing/Credit', 'FIXED_EXPENSE'),
        createBudgetLine(500, 'Emergency Fund', 'SAVINGS_CONTRIBUTION'),
      ];

      // Act
      const livingAllowance = calculator.calculateLivingAllowance(budgetLines);

      // Assert
      expect(livingAllowance).toBe(3563); // 8000 - (2200 + 450 + 150 + 1137 + 500)
    });

    it('should handle negative living allowance', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(5000, 'Monthly Income', 'INCOME'),
        createBudgetLine(6000, 'Expensive Housing', 'FIXED_EXPENSE'),
        createBudgetLine(1000, 'Savings', 'SAVINGS_CONTRIBUTION'),
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
        createTransaction(30, 'Repas restaurant', 'FIXED_EXPENSE'),
        createTransaction(50, 'Groceries', 'FIXED_EXPENSE'),
        createTransaction(25, 'Coffee', 'FIXED_EXPENSE'),
        createTransaction(1000, 'Salary', 'INCOME'), // Should be ignored
        createTransaction(500, 'Savings', 'SAVINGS_CONTRIBUTION'), // Should be ignored
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

    it('should return 0 when no FIXED_EXPENSE transactions exist', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(1000, 'Salary', 'INCOME'),
        createTransaction(500, 'Savings', 'SAVINGS_CONTRIBUTION'),
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
        createBudgetLine(8000, 'Monthly Income', 'INCOME'),
        createBudgetLine(2200, 'Housing Costs', 'FIXED_EXPENSE'),
        createBudgetLine(450, 'Health Insurance', 'FIXED_EXPENSE'),
        createBudgetLine(150, 'Phone Plan', 'FIXED_EXPENSE'),
        createBudgetLine(1137, 'Leasing/Credit', 'FIXED_EXPENSE'),
      ];

      const transactions: Transaction[] = [
        createTransaction(30, 'Repas restaurant', 'FIXED_EXPENSE'),
        createTransaction(50, 'Groceries', 'FIXED_EXPENSE'),
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
        createBudgetLine(1000, 'Monthly Income', 'INCOME'),
        createBudgetLine(900, 'Fixed Costs', 'FIXED_EXPENSE'),
      ];

      const transactions: Transaction[] = [
        createTransaction(200, 'Overspending', 'FIXED_EXPENSE'),
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
        createBudgetLine(8000, 'Monthly Income', 'INCOME'),
        createBudgetLine(2200, 'Housing Costs', 'FIXED_EXPENSE'),
        createBudgetLine(450, 'Health Insurance', 'FIXED_EXPENSE'),
        createBudgetLine(150, 'Phone Plan', 'FIXED_EXPENSE'),
        createBudgetLine(1137, 'Leasing/Credit', 'FIXED_EXPENSE'),
      ];

      const transactions: Transaction[] = [
        createTransaction(30, 'Repas restaurant', 'FIXED_EXPENSE'),
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
