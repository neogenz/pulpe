import { describe, it, expect } from 'vitest';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import {
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
  describe('calculateBudgetLineToggle - cascade to transactions', () => {
    it('should cascade checkedAt to allocated transactions when checking', () => {
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
      const result = calculateBudgetLineToggle('line-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.isChecking).toBe(true);
      expect(result!.updatedBudgetLines[0].checkedAt).not.toBeNull();
      expect(result!.updatedTransactions[0].checkedAt).not.toBeNull();
      expect(result!.updatedTransactions[1].checkedAt).not.toBeNull();
    });

    it('should cascade null checkedAt to allocated transactions when unchecking', () => {
      // Arrange
      const checkedAt = '2024-01-01T00:00:00.000Z';
      const budgetLines = [createBudgetLine({ id: 'line-1', checkedAt })];
      const transactions = [
        createTransaction({
          id: 'tx-1',
          budgetLineId: 'line-1',
          checkedAt,
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
      expect(result!.updatedTransactions[0].checkedAt).toBeNull();
    });

    it('should only update the targeted budget line, not others', () => {
      // Arrange
      const budgetLines = [
        createBudgetLine({ id: 'line-1', checkedAt: null }),
        createBudgetLine({ id: 'line-2', checkedAt: null }),
      ];

      // Act
      const result = calculateBudgetLineToggle('line-1', {
        budgetLines,
        transactions: [],
      });

      // Assert
      expect(result!.updatedBudgetLines[0].checkedAt).not.toBeNull();
      expect(result!.updatedBudgetLines[1].checkedAt).toBeNull();
    });

    it('should not cascade to transactions from other budget lines', () => {
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
          budgetLineId: 'line-2',
          checkedAt: null,
        }),
        createTransaction({ id: 'tx-3', budgetLineId: null, checkedAt: null }),
      ];

      // Act
      const result = calculateBudgetLineToggle('line-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(
        result!.updatedTransactions.find((tx) => tx.id === 'tx-1')!.checkedAt,
      ).not.toBeNull();
      expect(
        result!.updatedTransactions.find((tx) => tx.id === 'tx-2')!.checkedAt,
      ).toBeNull();
      expect(
        result!.updatedTransactions.find((tx) => tx.id === 'tx-3')!.checkedAt,
      ).toBeNull();
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

  describe('calculateTransactionToggle - no parent sync', () => {
    it('should toggle transaction without affecting parent budget line', () => {
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
      ];

      // Act
      const result = calculateTransactionToggle('tx-1', {
        budgetLines,
        transactions,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.isChecking).toBe(false);
      expect(result!.updatedTransactions[0].checkedAt).toBeNull();
    });

    it('should not auto-check parent when all allocated transactions become checked', () => {
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

      // Assert — transaction is checked but parent stays unchecked
      expect(result).not.toBeNull();
      expect(result!.isChecking).toBe(true);
      expect(
        result!.updatedTransactions.find((tx) => tx.id === 'tx-1')!.checkedAt,
      ).not.toBeNull();
    });

    it('should handle free transaction (no parent)', () => {
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
      expect(result!.isChecking).toBe(true);
      expect(result!.updatedTransactions[0].checkedAt).not.toBeNull();
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

    it('should not mutate original transactions array (calculateBudgetLineToggle)', () => {
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

    it('should not mutate original transactions array (calculateTransactionToggle)', () => {
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
      calculateTransactionToggle('tx-1', {
        budgetLines: originalBudgetLines,
        transactions: originalTransactions,
      });

      // Assert
      expect(originalTransactions[0].checkedAt).toBe(originalCheckedAt);
    });
  });
});
