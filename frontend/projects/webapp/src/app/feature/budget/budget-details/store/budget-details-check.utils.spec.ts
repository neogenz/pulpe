import { describe, it, expect } from 'vitest';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import {
  findAllocatedTransactions,
  areAllAllocatedTransactionsChecked,
  calculateBudgetLineToggle,
  calculateTransactionToggle,
} from './budget-details-check.utils';

const createBudgetLine = (overrides: Partial<BudgetLine> = {}): BudgetLine => ({
  id: 'line-1',
  budgetId: 'budget-1',
  name: 'Test Line',
  amount: 100,
  kind: 'expense',
  recurrence: 'fixed',
  isManuallyAdjusted: false,
  templateLineId: null,
  savingsGoalId: null,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: 'tx-1',
  budgetId: 'budget-1',
  budgetLineId: 'line-1',
  name: 'Test Transaction',
  amount: 50,
  kind: 'expense',
  transactionDate: '2024-01-15T00:00:00.000Z',
  category: null,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('Budget Details Check Utils', () => {
  describe('findAllocatedTransactions', () => {
    it('should return only transactions allocated to the specified budget line', () => {
      // Arrange
      const transactions = [
        createTransaction({ id: 'tx-1', budgetLineId: 'line-1' }),
        createTransaction({ id: 'tx-2', budgetLineId: 'line-1' }),
        createTransaction({ id: 'tx-3', budgetLineId: 'line-2' }),
        createTransaction({ id: 'tx-4', budgetLineId: null }),
      ];

      // Act
      const allocated = findAllocatedTransactions('line-1', transactions);

      // Assert
      expect(allocated).toHaveLength(2);
      expect(allocated.every((tx) => tx.budgetLineId === 'line-1')).toBe(true);
    });

    it('should return empty array when no transactions are allocated', () => {
      // Arrange
      const transactions = [
        createTransaction({ id: 'tx-1', budgetLineId: 'line-2' }),
        createTransaction({ id: 'tx-2', budgetLineId: null }),
      ];

      // Act
      const allocated = findAllocatedTransactions('line-1', transactions);

      // Assert
      expect(allocated).toHaveLength(0);
    });
  });

  describe('areAllAllocatedTransactionsChecked', () => {
    it('should return true when all allocated transactions are checked', () => {
      // Arrange
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
        createTransaction({
          id: 'tx-2',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-02T00:00:00.000Z',
        }),
      ];

      // Act & Assert
      expect(areAllAllocatedTransactionsChecked('line-1', transactions)).toBe(
        true,
      );
    });

    it('should return false when at least one allocated transaction is unchecked', () => {
      // Arrange
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
        createTransaction({
          id: 'tx-2',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
      ];

      // Act & Assert
      expect(areAllAllocatedTransactionsChecked('line-1', transactions)).toBe(
        false,
      );
    });

    it('should return false when no transactions are allocated', () => {
      // Arrange
      const transactions = [
        createTransaction({ id: 'tx-1', budgetLineId: 'line-2' }),
      ];

      // Act & Assert
      expect(areAllAllocatedTransactionsChecked('line-1', transactions)).toBe(
        false,
      );
    });
  });

  describe('calculateBudgetLineToggle - cascade to transactions', () => {
    it('should check all unchecked transactions when checking a budget line', () => {
      // Arrange
      const budgetLines = [createBudgetLine({ id: 'line-1', checkedAt: null })];
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
        createTransaction({
          id: 'tx-2',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
        createTransaction({
          id: 'tx-3',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
      ];

      // Act
      const result = calculateBudgetLineToggle('line-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.isChecking).toBe(true);
      expect(result!.updatedBudgetLines[0].checkedAt).not.toBeNull();
      expect(
        result!.updatedTransactions.every((tx) => tx.checkedAt !== null),
      ).toBe(true);
      expect(result!.transactionsToToggle).toHaveLength(2);
    });

    it('should uncheck all checked transactions when unchecking a budget line', () => {
      // Arrange
      const budgetLines = [
        createBudgetLine({
          id: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
      ];
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
        createTransaction({
          id: 'tx-2',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-02T00:00:00.000Z',
        }),
      ];

      // Act
      const result = calculateBudgetLineToggle('line-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.isChecking).toBe(false);
      expect(result!.updatedBudgetLines[0].checkedAt).toBeNull();
      expect(
        result!.updatedTransactions.every((tx) => tx.checkedAt === null),
      ).toBe(true);
      expect(result!.transactionsToToggle).toHaveLength(2);
    });

    it('should not affect transactions allocated to other budget lines', () => {
      // Arrange
      const budgetLines = [
        createBudgetLine({ id: 'line-1', checkedAt: null }),
        createBudgetLine({ id: 'line-2', checkedAt: null }),
      ];
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
        createTransaction({
          id: 'tx-2',
          budgetLineId: 'line-2',
          checkedAt: null,
        }),
      ];

      // Act
      const result = calculateBudgetLineToggle('line-1', {
        budgetLines,
        transactions,
      });

      // Assert
      const otherLineTx = result!.updatedTransactions.find(
        (tx) => tx.id === 'tx-2',
      );
      expect(otherLineTx!.checkedAt).toBeNull();
    });

    it('should return null when budget line does not exist', () => {
      // Act
      const result = calculateBudgetLineToggle('non-existent', {
        budgetLines: [],
        transactions: [],
      });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('calculateTransactionToggle - cascade to budget line', () => {
    it('should uncheck parent budget line when unchecking a transaction', () => {
      // Arrange
      const budgetLines = [
        createBudgetLine({
          id: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
      ];
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
        createTransaction({
          id: 'tx-2',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-02T00:00:00.000Z',
        }),
      ];

      // Act
      const result = calculateTransactionToggle('tx-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.isChecking).toBe(false);
      expect(result!.shouldToggleBudgetLine).toBe(true);
      expect(result!.budgetLineId).toBe('line-1');
      expect(result!.updatedBudgetLines[0].checkedAt).toBeNull();
    });

    it('should check parent budget line when all allocated transactions become checked', () => {
      // Arrange
      const budgetLines = [createBudgetLine({ id: 'line-1', checkedAt: null })];
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
        createTransaction({
          id: 'tx-2',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
      ];

      // Act
      const result = calculateTransactionToggle('tx-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.isChecking).toBe(true);
      expect(result!.shouldToggleBudgetLine).toBe(true);
      expect(result!.updatedBudgetLines[0].checkedAt).not.toBeNull();
    });

    it('should not check parent budget line when other transactions remain unchecked', () => {
      // Arrange
      const budgetLines = [createBudgetLine({ id: 'line-1', checkedAt: null })];
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
        createTransaction({
          id: 'tx-2',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
      ];

      // Act
      const result = calculateTransactionToggle('tx-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.isChecking).toBe(true);
      expect(result!.shouldToggleBudgetLine).toBe(false);
      expect(result!.updatedBudgetLines[0].checkedAt).toBeNull();
    });

    it('should not affect budget line when unchecking from already unchecked line', () => {
      // Arrange
      const budgetLines = [createBudgetLine({ id: 'line-1', checkedAt: null })];
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: '2024-01-01T00:00:00.000Z',
        }),
      ];

      // Act
      const result = calculateTransactionToggle('tx-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.isChecking).toBe(false);
      expect(result!.shouldToggleBudgetLine).toBe(false);
    });

    it('should handle transaction without parent budget line', () => {
      // Arrange
      const budgetLines = [createBudgetLine({ id: 'line-1' })];
      const transactions = [
        createTransaction({ id: 'tx-1', budgetLineId: null, checkedAt: null }),
      ];

      // Act
      const result = calculateTransactionToggle('tx-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.shouldToggleBudgetLine).toBe(false);
      expect(result!.budgetLineId).toBeNull();
    });

    it('should return null when transaction does not exist', () => {
      // Act
      const result = calculateTransactionToggle('non-existent', {
        budgetLines: [],
        transactions: [],
      });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('calculateBudgetLineToggle - temp ID handling', () => {
    it('should include temp transactions in transactionsToToggle when checking a budget line', () => {
      // This test documents the behavior that caused a production bug:
      // When a transaction has a temp ID (temp-xxx), calculateBudgetLineToggle
      // includes it in transactionsToToggle. The caller must ensure temp IDs
      // are replaced with real IDs before triggering a cascade toggle.
      const budgetLines = [createBudgetLine({ id: 'line-1', checkedAt: null })];
      const transactions = [
        createTransaction({
          id: 'real-uuid',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
        createTransaction({
          id: 'temp-d8948d20-f63f-4031-b946-b270622513aa',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
      ];

      const result = calculateBudgetLineToggle('line-1', {
        budgetLines,
        transactions,
      });

      expect(result).not.toBeNull();
      expect(result!.transactionsToToggle).toHaveLength(2);
      expect(result!.transactionsToToggle.map((tx) => tx.id)).toContain(
        'temp-d8948d20-f63f-4031-b946-b270622513aa',
      );
    });

    it('should only include real transaction IDs in transactionsToToggle', () => {
      // After the fix: the temp ID is replaced with the real ID before cascade,
      // so transactionsToToggle only contains real IDs
      const budgetLines = [createBudgetLine({ id: 'line-1', checkedAt: null })];
      const transactions = [
        createTransaction({
          id: 'real-uuid-1',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
        createTransaction({
          id: 'real-uuid-2',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
      ];

      const result = calculateBudgetLineToggle('line-1', {
        budgetLines,
        transactions,
      });

      expect(result).not.toBeNull();
      expect(result!.transactionsToToggle).toHaveLength(2);
      expect(
        result!.transactionsToToggle.every((tx) => !tx.id.startsWith('temp-')),
      ).toBe(true);
    });
  });

  describe('Immutability', () => {
    it('should not mutate original budget lines array', () => {
      // Arrange
      const originalBudgetLines = [
        createBudgetLine({ id: 'line-1', checkedAt: null }),
      ];
      const originalTransactions = [
        createTransaction({ id: 'tx-1', budgetLineId: 'line-1' }),
      ];
      const originalCheckedAt = originalBudgetLines[0].checkedAt;

      // Act
      calculateBudgetLineToggle('line-1', {
        budgetLines: originalBudgetLines,
        transactions: originalTransactions,
      });

      // Assert
      expect(originalBudgetLines[0].checkedAt).toBe(originalCheckedAt);
    });

    it('should not mutate original transactions array', () => {
      // Arrange
      const originalBudgetLines = [
        createBudgetLine({ id: 'line-1', checkedAt: null }),
      ];
      const originalTransactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt: null,
        }),
      ];
      const originalCheckedAt = originalTransactions[0].checkedAt;

      // Act
      calculateBudgetLineToggle('line-1', {
        budgetLines: originalBudgetLines,
        transactions: originalTransactions,
      });

      // Assert
      expect(originalTransactions[0].checkedAt).toBe(originalCheckedAt);
    });
  });
});
