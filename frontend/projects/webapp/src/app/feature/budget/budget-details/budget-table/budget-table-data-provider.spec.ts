import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BudgetTableDataProvider } from './budget-table-data-provider';
import { BudgetCalculator } from '@core/budget/budget-calculator';
import type { BudgetLine, Transaction } from '@pulpe/shared';
import {
  createMockBudgetLine,
  createMockTransaction,
  createMockRolloverBudgetLine,
} from '../../../../testing/mock-factories';

describe('BudgetTableDataProvider', () => {
  let service: BudgetTableDataProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BudgetTableDataProvider,
        BudgetCalculator,
        provideZonelessChangeDetection(),
      ],
    });

    service = TestBed.inject(BudgetTableDataProvider);
  });

  describe('Display Order Business Rules', () => {
    it('should display budget lines before transactions', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'budget-1',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
      ];
      const transactions: Transaction[] = [
        createMockTransaction({
          id: 'transaction-1',
          name: 'Coffee',
          amount: 5,
          kind: 'expense',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions,
        editingLineId: null,
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].metadata.itemType).toBe('budget_line');
      expect(result[0].data.name).toBe('Salary');
      expect(result[1].metadata.itemType).toBe('transaction');
      expect(result[1].data.name).toBe('Coffee');
    });

    it('should order budget lines by recurrence then createdAt', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'fixed-new',
          name: 'Fixed New',
          recurrence: 'fixed',
          createdAt: '2024-02-01T00:00:00Z',
        }),
        createMockBudgetLine({
          id: 'oneoff',
          name: 'One Off',
          recurrence: 'one_off',
          createdAt: '2024-01-01T00:00:00Z',
        }),
        createMockBudgetLine({
          id: 'fixed-old',
          name: 'Fixed Old',
          recurrence: 'fixed',
          createdAt: '2024-01-01T00:00:00Z',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      expect(result.map((item) => item.data.id)).toEqual([
        'fixed-old',
        'fixed-new',
        'oneoff',
      ]);
    });

    it('should fall back to kind ordering when budget lines share date and recurrence', () => {
      const createdAt = '2024-01-01T00:00:00Z';
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'expense-line',
          name: 'Expense',
          recurrence: 'fixed',
          kind: 'expense',
          createdAt,
        }),
        createMockBudgetLine({
          id: 'income-line',
          name: 'Income',
          recurrence: 'fixed',
          kind: 'income',
          createdAt,
        }),
        createMockBudgetLine({
          id: 'saving-line',
          name: 'Saving',
          recurrence: 'fixed',
          kind: 'saving',
          createdAt,
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      expect(result.map((item) => item.data.id)).toEqual([
        'income-line',
        'saving-line',
        'expense-line',
      ]);
    });

    it('should maintain ordering across mixed data types with date priority', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'fixed-early',
          name: 'Fixed Early',
          recurrence: 'fixed',
          createdAt: '2024-01-01T00:00:00Z',
          kind: 'income',
        }),
        createMockBudgetLine({
          id: 'fixed-late',
          name: 'Fixed Late',
          recurrence: 'fixed',
          createdAt: '2024-02-01T00:00:00Z',
          kind: 'expense',
        }),
      ];
      const transactions: Transaction[] = [
        createMockTransaction({
          id: 'transaction-late',
          name: 'Transaction Late',
          amount: 200,
          kind: 'expense',
          transactionDate: '2024-04-02',
        }),
        createMockTransaction({
          id: 'transaction-early',
          name: 'Transaction Early',
          amount: 80,
          kind: 'income',
          transactionDate: '2024-04-01',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions,
        editingLineId: null,
      });

      expect(result.map((item) => item.data.id)).toEqual([
        'fixed-early',
        'fixed-late',
        'transaction-early',
        'transaction-late',
      ]);
    });
  });

  describe('Rollover Line Management', () => {
    it('should identify rollover lines correctly', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'regular-line',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
        createMockRolloverBudgetLine({
          id: 'rollover-line',
          name: 'rollover_12_2024',
          amount: 150,
          kind: 'income',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      // Assert
      expect(result).toHaveLength(2);

      const rolloverItem = result.find((item) =>
        item.data.name.includes('rollover'),
      );
      const regularItem = result.find(
        (item) => !item.data.name.includes('rollover'),
      );

      expect(rolloverItem?.metadata.isRollover).toBe(true);
      expect(regularItem?.metadata.isRollover).toBe(false);
    });

    it('should prevent editing of rollover lines even when editingLineId matches', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockRolloverBudgetLine({
          id: 'rollover-line',
          name: 'rollover_12_2024',
          amount: 150,
          kind: 'income',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: 'rollover-line', // Try to edit rollover line
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].metadata.isRollover).toBe(true);
      expect(result[0].metadata.isEditing).toBe(false); // Should not be editable
    });

    it('should allow editing of regular budget lines', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'regular-line',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: 'regular-line',
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].metadata.isRollover).toBe(false);
      expect(result[0].metadata.isEditing).toBe(true); // Should be editable
    });

    it('should sort rollover lines according to business rules', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        // Fixed expense (should be first after fixed income)
        createMockBudgetLine({
          id: 'expense-line',
          name: 'Regular Expense',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
        // Rollover income (one_off recurrence, should be after fixed items)
        createMockRolloverBudgetLine({
          id: 'rollover-income',
          name: 'rollover_12_2024',
          amount: 150,
          kind: 'income',
        }),
        // Fixed income (should be first)
        createMockBudgetLine({
          id: 'income-line',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      // Assert
      expect(result).toHaveLength(3);

      // Expected order: Fixed income, Fixed expense, One-off income (rollover)
      expect(result[0].data.name).toBe('Salary'); // Fixed income
      expect(result[1].data.name).toBe('Regular Expense'); // Fixed expense
      expect(result[2].data.name).toBe('rollover_12_2024'); // One-off income (rollover)
      expect(result[2].metadata.isRollover).toBe(true);
    });
  });

  describe('Cumulative Balance Calculation', () => {
    it('should calculate cumulative balance for all items', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'salary',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
        createMockBudgetLine({
          id: 'rent',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];
      const transactions: Transaction[] = [
        createMockTransaction({
          id: 'grocery',
          name: 'Grocery',
          amount: 200,
          kind: 'expense',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions,
        editingLineId: null,
      });

      // Assert
      expect(result).toHaveLength(3);

      // All items should have cumulative balance calculated
      result.forEach((item) => {
        expect(typeof item.metadata.cumulativeBalance).toBe('number');
      });

      // Expected cumulative calculation based on sorted order
      expect(result[0].metadata.cumulativeBalance).toBe(5000); // Salary: +5000
      expect(result[1].metadata.cumulativeBalance).toBe(3500); // Rent: 5000 - 1500 = 3500
      expect(result[2].metadata.cumulativeBalance).toBe(3300); // Grocery: 3500 - 200 = 3300
    });

    it('should handle negative balances correctly', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'salary',
          name: 'Salary',
          amount: 2000,
          kind: 'income',
          recurrence: 'fixed',
        }),
        createMockBudgetLine({
          id: 'expensive-rent',
          name: 'Expensive Rent',
          amount: 2500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].metadata.cumulativeBalance).toBe(2000); // Income
      expect(result[1].metadata.cumulativeBalance).toBe(-500); // Negative balance
    });

    it('should maintain balance continuity with mixed rollover and regular lines', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'salary',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
        createMockRolloverBudgetLine({
          id: 'rollover',
          name: 'rollover_12_2024',
          amount: 200,
          kind: 'income',
        }),
        createMockBudgetLine({
          id: 'rent',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      // Assert
      expect(result).toHaveLength(3);

      // Cumulative balance calculation based on sorted order
      expect(result[0].metadata.cumulativeBalance).toBe(5000); // Salary: +5000
      expect(result[1].metadata.cumulativeBalance).toBe(3500); // Rent: 5000 - 1500 = 3500
      expect(result[2].metadata.cumulativeBalance).toBe(3700); // Rollover: 3500 + 200 = 3700
    });
  });

  describe('Editing State Management', () => {
    it('should mark line as editing when editingLineId matches', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'editable-line',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
        createMockBudgetLine({
          id: 'other-line',
          name: 'Utilities',
          amount: 200,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: 'editable-line',
      });

      // Assert
      expect(result).toHaveLength(2);

      const editingItem = result.find(
        (item) => item.data.id === 'editable-line',
      );
      const otherItem = result.find((item) => item.data.id === 'other-line');

      expect(editingItem?.metadata.isEditing).toBe(true);
      expect(otherItem?.metadata.isEditing).toBe(false);
    });

    it('should not mark any line as editing when editingLineId is null', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'line-1',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
        createMockBudgetLine({
          id: 'line-2',
          name: 'Utilities',
          amount: 200,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      // Assert
      result.forEach((item) => {
        expect(item.metadata.isEditing).toBe(false);
      });
    });

    it('should never allow editing of rollover lines regardless of editingLineId', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockRolloverBudgetLine({
          id: 'rollover-line',
          name: 'rollover_12_2024',
          amount: 150,
          kind: 'income',
        }),
        createMockBudgetLine({
          id: 'regular-line',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: 'rollover-line', // Try to edit rollover
      });

      // Assert
      const rolloverItem = result.find((item) =>
        item.data.name.includes('rollover'),
      );

      expect(rolloverItem?.metadata.isRollover).toBe(true);
      expect(rolloverItem?.metadata.isEditing).toBe(false); // Never editable
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty budgetLines and transactions', () => {
      // Arrange & Act
      const result = service.provideTableData({
        budgetLines: [],
        transactions: [],
        editingLineId: null,
      });

      // Assert
      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle only transactions without budget lines', () => {
      // Arrange
      const transactions: Transaction[] = [
        createMockTransaction({
          id: 'transaction-1',
          name: 'Coffee',
          amount: 5,
          kind: 'expense',
        }),
        createMockTransaction({
          id: 'transaction-2',
          name: 'Lunch',
          amount: 15,
          kind: 'expense',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines: [],
        transactions,
        editingLineId: null,
      });

      // Assert
      expect(result).toHaveLength(2);
      result.forEach((item) => {
        expect(item.metadata.itemType).toBe('transaction');
        expect(typeof item.metadata.cumulativeBalance).toBe('number');
      });
    });

    it('should handle only budget lines without transactions', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'income',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
        createMockBudgetLine({
          id: 'expense',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      // Assert
      expect(result).toHaveLength(2);
      result.forEach((item) => {
        expect(item.metadata.itemType).toBe('budget_line');
        expect(typeof item.metadata.cumulativeBalance).toBe('number');
      });
    });

    it('should provide correct metadata for all item types', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'regular-line',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
        createMockRolloverBudgetLine({
          id: 'rollover-line',
          name: 'rollover_12_2024',
          amount: 200,
          kind: 'income',
        }),
      ];
      const transactions: Transaction[] = [
        createMockTransaction({
          id: 'transaction-1',
          name: 'Coffee',
          amount: 5,
          kind: 'expense',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions,
        editingLineId: 'regular-line',
      });

      // Assert
      expect(result).toHaveLength(3);

      // Regular budget line
      const regularItem = result.find(
        (item) => item.data.id === 'regular-line',
      );
      expect(regularItem?.metadata.itemType).toBe('budget_line');
      expect(regularItem?.metadata.isRollover).toBe(false);
      expect(regularItem?.metadata.isEditing).toBe(true);
      expect(typeof regularItem?.metadata.cumulativeBalance).toBe('number');

      // Rollover budget line
      const rolloverItem = result.find(
        (item) => item.data.id === 'rollover-line',
      );
      expect(rolloverItem?.metadata.itemType).toBe('budget_line');
      expect(rolloverItem?.metadata.isRollover).toBe(true);
      expect(rolloverItem?.metadata.isEditing).toBe(false); // Never editable
      expect(typeof rolloverItem?.metadata.cumulativeBalance).toBe('number');

      // Transaction
      const transactionItem = result.find(
        (item) => item.data.id === 'transaction-1',
      );
      expect(transactionItem?.metadata.itemType).toBe('transaction');
      expect(transactionItem?.metadata.isRollover).toBe(false);
      expect(transactionItem?.metadata.isEditing).toBe(false); // Transactions not editable via this mechanism
      expect(typeof transactionItem?.metadata.cumulativeBalance).toBe('number');
    });

    it('should expose template linkage and propagation lock flags for budget lines', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'linked-line',
          templateLineId: 'tpl-1',
          isManuallyAdjusted: false,
        }),
        createMockBudgetLine({
          id: 'locked-line',
          templateLineId: 'tpl-2',
          isManuallyAdjusted: true,
        }),
        createMockBudgetLine({
          id: 'manual-line',
          templateLineId: null,
          isManuallyAdjusted: true,
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      const linked = result.find((item) => item.data.id === 'linked-line');
      const locked = result.find((item) => item.data.id === 'locked-line');
      const manual = result.find((item) => item.data.id === 'manual-line');

      expect(linked?.metadata.isTemplateLinked).toBe(true);
      expect(linked?.metadata.isPropagationLocked).toBe(false);

      expect(locked?.metadata.isTemplateLinked).toBe(true);
      expect(locked?.metadata.isPropagationLocked).toBe(true);

      expect(manual?.metadata.isTemplateLinked).toBe(false);
      expect(manual?.metadata.isPropagationLocked).toBe(false);
    });
  });

  describe('View Mode: Transactions', () => {
    it('should include allocated transactions when viewMode is transactions', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'envelope-1',
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];
      const transactions: Transaction[] = [
        createMockTransaction({
          id: 'allocated-tx',
          name: 'Carrefour',
          amount: 100,
          kind: 'expense',
          budgetLineId: 'envelope-1', // Allocated to envelope
        }),
        createMockTransaction({
          id: 'free-tx',
          name: 'Coffee',
          amount: 20,
          kind: 'expense',
          budgetLineId: null, // Free transaction
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions,
        editingLineId: null,
        viewMode: 'transactions',
      });

      // All items should be displayed
      expect(result).toHaveLength(3);
      expect(result.map((item) => item.data.id)).toContain('allocated-tx');
      expect(result.map((item) => item.data.id)).toContain('free-tx');
    });

    it('should exclude allocated transactions when viewMode is envelopes', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'envelope-1',
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];
      const transactions: Transaction[] = [
        createMockTransaction({
          id: 'allocated-tx',
          name: 'Carrefour',
          amount: 100,
          kind: 'expense',
          budgetLineId: 'envelope-1',
        }),
        createMockTransaction({
          id: 'free-tx',
          name: 'Coffee',
          amount: 20,
          kind: 'expense',
          budgetLineId: null,
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions,
        editingLineId: null,
        viewMode: 'envelopes',
      });

      // Only envelope and free transaction
      expect(result).toHaveLength(2);
      expect(result.map((item) => item.data.id)).not.toContain('allocated-tx');
      expect(result.map((item) => item.data.id)).toContain('free-tx');
    });

    it('should NOT count allocated transactions in cumulative balance (already in envelope consumption)', () => {
      // This test verifies the bug fix: allocated transactions should not
      // impact cumulative balance because their amount is already accounted
      // for in the parent envelope's consumption.
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'salary',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
        createMockBudgetLine({
          id: 'groceries',
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];
      const transactions: Transaction[] = [
        createMockTransaction({
          id: 'allocated-grocery-tx',
          name: 'Carrefour',
          amount: 100,
          kind: 'expense',
          budgetLineId: 'groceries', // Allocated
        }),
        createMockTransaction({
          id: 'free-coffee-tx',
          name: 'Coffee',
          amount: 20,
          kind: 'expense',
          budgetLineId: null, // Free (not allocated)
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions,
        editingLineId: null,
        viewMode: 'transactions',
      });

      // Find items by ID
      const salary = result.find((item) => item.data.id === 'salary');
      const groceries = result.find((item) => item.data.id === 'groceries');
      const allocatedTx = result.find(
        (item) => item.data.id === 'allocated-grocery-tx',
      );
      const freeTx = result.find((item) => item.data.id === 'free-coffee-tx');

      // Salary adds +5000
      expect(salary?.metadata.cumulativeBalance).toBe(5000);

      // Groceries uses MAX(500 planned, 100 consumed) = 500 → balance = 5000 - 500 = 4500
      expect(groceries?.metadata.cumulativeBalance).toBe(4500);

      // Allocated transaction should NOT impact balance (already in groceries consumption)
      // It should have the same balance as the previous item (groceries)
      expect(allocatedTx?.metadata.cumulativeBalance).toBe(4500);

      // Free transaction DOES impact balance: 4500 - 20 = 4480
      expect(freeTx?.metadata.cumulativeBalance).toBe(4480);
    });

    it('should include envelope name for allocated transactions', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'envelope-1',
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];
      const transactions: Transaction[] = [
        createMockTransaction({
          id: 'allocated-tx',
          name: 'Carrefour',
          amount: 100,
          kind: 'expense',
          budgetLineId: 'envelope-1',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions,
        editingLineId: null,
        viewMode: 'transactions',
      });

      const allocatedTx = result.find(
        (item) => item.data.id === 'allocated-tx',
      );
      expect(allocatedTx?.metadata.envelopeName).toBe('Groceries');
    });
  });
});
