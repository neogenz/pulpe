import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';
import {
  mapBudgetLineToTransaction,
  mapBudgetLinesToTransactions,
} from './budget-line-mapper';
import { type BudgetLine, type Transaction } from '@pulpe/shared';

describe('Budget Line Mapper Utils', () => {
  beforeEach(() => {
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
    kind: 'expense',
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });

  describe('mapBudgetLineToTransaction', () => {
    it('should map a budget line to a transaction', () => {
      // Arrange
      const budgetLine = createBudgetLine();
      const budgetId = 'budget-789';

      // Act
      const result = mapBudgetLineToTransaction(budgetLine, budgetId);

      // Assert
      expect(result).toEqual<Transaction>({
        id: 'line-123',
        budgetId: 'budget-789',
        name: 'Test Budget Line',
        amount: 1000,
        kind: 'expense',
        transactionDate: '2024-01-15T10:00:00.000Z',
        isOutOfBudget: false,
        category: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should handle income kind correctly', () => {
      // Arrange
      const budgetLine = createBudgetLine({
        kind: 'income',
        name: 'Monthly Salary',
        amount: 5000,
      });

      // Act
      const result = mapBudgetLineToTransaction(budgetLine, 'budget-123');

      // Assert
      expect(result.kind).toBe('income');
      expect(result.name).toBe('Monthly Salary');
      expect(result.amount).toBe(5000);
    });

    it('should handle saving kind correctly', () => {
      // Arrange
      const budgetLine = createBudgetLine({
        kind: 'saving',
        name: 'Emergency Fund',
        amount: 500,
      });

      // Act
      const result = mapBudgetLineToTransaction(budgetLine, 'budget-123');

      // Assert
      expect(result.kind).toBe('saving');
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
      const result = mapBudgetLineToTransaction(budgetLine, 'budget-123');

      // Assert
      expect(result.createdAt).toBe('2023-12-01T00:00:00.000Z');
      expect(result.updatedAt).toBe('2023-12-15T00:00:00.000Z');
    });

    it('should always set isOutOfBudget to false', () => {
      // Arrange
      const budgetLine = createBudgetLine();

      // Act
      const result = mapBudgetLineToTransaction(budgetLine, 'budget-123');

      // Assert
      expect(result.isOutOfBudget).toBe(false);
    });

    it('should always set category to null', () => {
      // Arrange
      const budgetLine = createBudgetLine();

      // Act
      const result = mapBudgetLineToTransaction(budgetLine, 'budget-123');

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
      const result = mapBudgetLineToTransaction(budgetLine, newBudgetId);

      // Assert
      expect(result.budgetId).toBe('new-budget-id');
    });
  });

  describe('mapBudgetLinesToTransactions', () => {
    it('should map multiple budget lines to transactions', () => {
      // Arrange
      const budgetLines = [
        createBudgetLine({ id: 'line-1', name: 'Rent', amount: 1500 }),
        createBudgetLine({ id: 'line-2', name: 'Internet', amount: 50 }),
        createBudgetLine({ id: 'line-3', name: 'Phone', amount: 30 }),
      ];
      const budgetId = 'budget-123';

      // Act
      const result = mapBudgetLinesToTransactions(budgetLines, budgetId);

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
      const result = mapBudgetLinesToTransactions(budgetLines, 'budget-123');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle mixed transaction kinds', () => {
      // Arrange
      const budgetLines = [
        createBudgetLine({ kind: 'income', name: 'Salary' }),
        createBudgetLine({ kind: 'expense', name: 'Rent' }),
        createBudgetLine({ kind: 'saving', name: 'Savings' }),
      ];

      // Act
      const result = mapBudgetLinesToTransactions(budgetLines, 'budget-123');

      // Assert
      expect(result[0].kind).toBe('income');
      expect(result[1].kind).toBe('expense');
      expect(result[2].kind).toBe('saving');
    });
  });
});
