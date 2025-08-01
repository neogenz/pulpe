import { describe, beforeEach, it, expect, vi } from 'vitest';
import { BudgetLineMapper } from './budget-line-mapper';
import { BudgetLine, Transaction } from '@pulpe/shared';

describe('BudgetLineMapper', () => {
  let mapper: BudgetLineMapper;

  beforeEach(() => {
    mapper = new BudgetLineMapper();
    // Mock the current date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createBudgetLine = (
    overrides: Partial<BudgetLine> = {},
  ): BudgetLine => ({
    id: 'line-123',
    budgetId: 'budget-456',
    templateLineId: null,
    savingsGoalId: null,
    name: 'Test Budget Line',
    amount: 1000,
    kind: 'FIXED_EXPENSE',
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });

  describe('toTransaction', () => {
    it('should map a budget line to a transaction', () => {
      // Arrange
      const budgetLine = createBudgetLine();
      const budgetId = 'budget-789';

      // Act
      const result = mapper.toTransaction(budgetLine, budgetId);

      // Assert
      expect(result).toEqual<Transaction>({
        id: 'line-123',
        budgetId: 'budget-789',
        name: 'Test Budget Line',
        amount: 1000,
        kind: 'FIXED_EXPENSE',
        transactionDate: '2024-01-15T10:00:00.000Z',
        isOutOfBudget: false,
        category: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should handle INCOME kind correctly', () => {
      // Arrange
      const budgetLine = createBudgetLine({
        kind: 'INCOME',
        name: 'Monthly Salary',
        amount: 5000,
      });

      // Act
      const result = mapper.toTransaction(budgetLine, 'budget-123');

      // Assert
      expect(result.kind).toBe('INCOME');
      expect(result.name).toBe('Monthly Salary');
      expect(result.amount).toBe(5000);
    });

    it('should handle SAVINGS_CONTRIBUTION kind correctly', () => {
      // Arrange
      const budgetLine = createBudgetLine({
        kind: 'SAVINGS_CONTRIBUTION',
        name: 'Emergency Fund',
        amount: 500,
      });

      // Act
      const result = mapper.toTransaction(budgetLine, 'budget-123');

      // Assert
      expect(result.kind).toBe('SAVINGS_CONTRIBUTION');
      expect(result.name).toBe('Emergency Fund');
      expect(result.amount).toBe(500);
    });

    it('should preserve budget line timestamps', () => {
      // Arrange
      const budgetLine = createBudgetLine({
        createdAt: '2023-12-01T00:00:00.000Z',
        updatedAt: '2023-12-15T00:00:00.000Z',
      });

      // Act
      const result = mapper.toTransaction(budgetLine, 'budget-123');

      // Assert
      expect(result.createdAt).toBe('2023-12-01T00:00:00.000Z');
      expect(result.updatedAt).toBe('2023-12-15T00:00:00.000Z');
    });

    it('should always set isOutOfBudget to false', () => {
      // Arrange
      const budgetLine = createBudgetLine();

      // Act
      const result = mapper.toTransaction(budgetLine, 'budget-123');

      // Assert
      expect(result.isOutOfBudget).toBe(false);
    });

    it('should always set category to null', () => {
      // Arrange
      const budgetLine = createBudgetLine();

      // Act
      const result = mapper.toTransaction(budgetLine, 'budget-123');

      // Assert
      expect(result.category).toBe(null);
    });

    it('should use the provided budgetId instead of the budgetLine budgetId', () => {
      // Arrange
      const budgetLine = createBudgetLine({
        budgetId: 'original-budget-id',
      });
      const newBudgetId = 'new-budget-id';

      // Act
      const result = mapper.toTransaction(budgetLine, newBudgetId);

      // Assert
      expect(result.budgetId).toBe('new-budget-id');
    });
  });

  describe('toTransactions', () => {
    it('should map multiple budget lines to transactions', () => {
      // Arrange
      const budgetLines = [
        createBudgetLine({ id: 'line-1', name: 'Rent', amount: 1500 }),
        createBudgetLine({ id: 'line-2', name: 'Internet', amount: 50 }),
        createBudgetLine({ id: 'line-3', name: 'Phone', amount: 30 }),
      ];
      const budgetId = 'budget-123';

      // Act
      const result = mapper.toTransactions(budgetLines, budgetId);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('line-1');
      expect(result[0].name).toBe('Rent');
      expect(result[1].id).toBe('line-2');
      expect(result[1].name).toBe('Internet');
      expect(result[2].id).toBe('line-3');
      expect(result[2].name).toBe('Phone');
      expect(result.every((t) => t.budgetId === budgetId)).toBe(true);
    });

    it('should handle empty array', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [];

      // Act
      const result = mapper.toTransactions(budgetLines, 'budget-123');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle mixed transaction kinds', () => {
      // Arrange
      const budgetLines = [
        createBudgetLine({ kind: 'INCOME', name: 'Salary' }),
        createBudgetLine({ kind: 'FIXED_EXPENSE', name: 'Rent' }),
        createBudgetLine({ kind: 'SAVINGS_CONTRIBUTION', name: 'Savings' }),
      ];

      // Act
      const result = mapper.toTransactions(budgetLines, 'budget-123');

      // Assert
      expect(result[0].kind).toBe('INCOME');
      expect(result[1].kind).toBe('FIXED_EXPENSE');
      expect(result[2].kind).toBe('SAVINGS_CONTRIBUTION');
    });
  });
});
