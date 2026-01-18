import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BudgetTableDataProvider } from './budget-table-data-provider';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import {
  createMockBudgetLine,
  createMockTransaction,
  createMockRolloverBudgetLine,
} from '../../../../testing/mock-factories';
import type {
  BudgetLineTableItem,
  TableRowItem,
  TransactionTableItem,
} from './budget-table-models';

/**
 * Helper to filter out group headers and get only data items
 */
const filterDataItems = (
  items: TableRowItem[],
): (BudgetLineTableItem | TransactionTableItem)[] =>
  items.filter(
    (item): item is BudgetLineTableItem | TransactionTableItem =>
      item.metadata.itemType !== 'group_header',
  );

describe('BudgetTableDataProvider', () => {
  let service: BudgetTableDataProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BudgetTableDataProvider, provideZonelessChangeDetection()],
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(2);
      expect(dataItems[0].metadata.itemType).toBe('budget_line');
      expect(dataItems[0].data.name).toBe('Salary');
      expect(dataItems[1].metadata.itemType).toBe('transaction');
      expect(dataItems[1].data.name).toBe('Coffee');
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

      const dataItems = filterDataItems(result);
      expect(dataItems.map((item) => item.data.id)).toEqual([
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

      const dataItems = filterDataItems(result);
      expect(dataItems.map((item) => item.data.id)).toEqual([
        'income-line',
        'saving-line',
        'expense-line',
      ]);
    });

    it('should maintain ordering across mixed data types with date priority, grouped by kind', () => {
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

      // Items are grouped by kind (income, saving, expense), then sorted within each group
      const dataItems = filterDataItems(result);
      expect(dataItems.map((item) => item.data.id)).toEqual([
        'fixed-early', // income group: budget line first
        'transaction-early', // income group: transaction
        'fixed-late', // expense group: budget line first
        'transaction-late', // expense group: transaction
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(2);

      const rolloverItem = dataItems.find((item) =>
        item.data.name.includes('rollover'),
      );
      const regularItem = dataItems.find(
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(1);
      expect(dataItems[0].metadata.isRollover).toBe(true);
      expect(dataItems[0].metadata.isEditing).toBe(false); // Should not be editable
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(1);
      expect(dataItems[0].metadata.isRollover).toBe(false);
      expect(dataItems[0].metadata.isEditing).toBe(true); // Should be editable
    });

    it('should sort rollover lines according to business rules, grouped by kind', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        // Fixed expense
        createMockBudgetLine({
          id: 'expense-line',
          name: 'Regular Expense',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
        // Rollover income (one_off recurrence)
        createMockRolloverBudgetLine({
          id: 'rollover-income',
          name: 'rollover_12_2024',
          amount: 150,
          kind: 'income',
        }),
        // Fixed income
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(3);

      // Items are grouped by kind (income first, then expense)
      // Within income group: fixed items before one_off (rollover)
      expect(dataItems[0].data.name).toBe('Salary'); // Income group: fixed
      expect(dataItems[1].data.name).toBe('rollover_12_2024'); // Income group: one_off (rollover)
      expect(dataItems[1].metadata.isRollover).toBe(true);
      expect(dataItems[2].data.name).toBe('Regular Expense'); // Expense group
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(3);

      // All items should have cumulative balance calculated
      dataItems.forEach((item) => {
        expect(typeof item.metadata.cumulativeBalance).toBe('number');
      });

      // Expected cumulative calculation based on sorted order
      expect(dataItems[0].metadata.cumulativeBalance).toBe(5000); // Salary: +5000
      expect(dataItems[1].metadata.cumulativeBalance).toBe(3500); // Rent: 5000 - 1500 = 3500
      expect(dataItems[2].metadata.cumulativeBalance).toBe(3300); // Grocery: 3500 - 200 = 3300
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(2);
      expect(dataItems[0].metadata.cumulativeBalance).toBe(2000); // Income
      expect(dataItems[1].metadata.cumulativeBalance).toBe(-500); // Negative balance
    });

    it('should calculate cumulative balance in display order (after grouping by kind)', () => {
      // Arrange - items with different kinds that will be reordered by grouping
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'expense-first',
          name: 'Rent',
          amount: 1000,
          kind: 'expense',
          recurrence: 'fixed',
          createdAt: '2024-01-01T00:00:00Z',
        }),
        createMockBudgetLine({
          id: 'income-second',
          name: 'Salary',
          amount: 3000,
          kind: 'income',
          recurrence: 'fixed',
          createdAt: '2024-01-02T00:00:00Z',
        }),
        createMockBudgetLine({
          id: 'saving-third',
          name: 'Emergency Fund',
          amount: 500,
          kind: 'saving',
          recurrence: 'fixed',
          createdAt: '2024-01-03T00:00:00Z',
        }),
      ];

      // Act
      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      // Assert - display order is grouped by kind: income → saving → expense
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(3);

      // Income first
      expect(dataItems[0].data.name).toBe('Salary');
      expect(dataItems[0].metadata.cumulativeBalance).toBe(3000); // +3000

      // Saving second
      expect(dataItems[1].data.name).toBe('Emergency Fund');
      expect(dataItems[1].metadata.cumulativeBalance).toBe(2500); // 3000 - 500

      // Expense last
      expect(dataItems[2].data.name).toBe('Rent');
      expect(dataItems[2].metadata.cumulativeBalance).toBe(1500); // 2500 - 1000
    });

    it('should maintain balance continuity with mixed rollover and regular lines, grouped by kind', () => {
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

      // Assert - items are grouped by kind for display (income first, then expense)
      // Cumulative balance is calculated in display order (after grouping)
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(3);

      // Display order: Salary → Rollover (both income) → Rent (expense)
      // Balance calculated in this display order
      expect(dataItems[0].data.name).toBe('Salary');
      expect(dataItems[0].metadata.cumulativeBalance).toBe(5000); // +5000
      expect(dataItems[1].data.name).toBe('rollover_12_2024');
      expect(dataItems[1].metadata.cumulativeBalance).toBe(5200); // 5000 + 200
      expect(dataItems[2].data.name).toBe('Rent');
      expect(dataItems[2].metadata.cumulativeBalance).toBe(3700); // 5200 - 1500
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(2);

      const editingItem = dataItems.find(
        (item) => item.data.id === 'editable-line',
      );
      const otherItem = dataItems.find((item) => item.data.id === 'other-line');

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
      const dataItems = filterDataItems(result);
      dataItems.forEach((item) => {
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
      const dataItems = filterDataItems(result);
      const rolloverItem = dataItems.find((item) =>
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(2);
      dataItems.forEach((item) => {
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(2);
      dataItems.forEach((item) => {
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
      const dataItems = filterDataItems(result);
      expect(dataItems).toHaveLength(3);

      // Regular budget line
      const regularItem = dataItems.find(
        (item) => item.data.id === 'regular-line',
      );
      expect(regularItem?.metadata.itemType).toBe('budget_line');
      expect(regularItem?.metadata.isRollover).toBe(false);
      expect(regularItem?.metadata.isEditing).toBe(true);
      expect(typeof regularItem?.metadata.cumulativeBalance).toBe('number');

      // Rollover budget line
      const rolloverItem = dataItems.find(
        (item) => item.data.id === 'rollover-line',
      );
      expect(rolloverItem?.metadata.itemType).toBe('budget_line');
      expect(rolloverItem?.metadata.isRollover).toBe(true);
      expect(rolloverItem?.metadata.isEditing).toBe(false); // Never editable
      expect(typeof rolloverItem?.metadata.cumulativeBalance).toBe('number');

      // Transaction
      const transactionItem = dataItems.find(
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

      const dataItems = filterDataItems(result);
      const linked = dataItems.find((item) => item.data.id === 'linked-line');
      const locked = dataItems.find((item) => item.data.id === 'locked-line');
      const manual = dataItems.find((item) => item.data.id === 'manual-line');

      expect(linked?.metadata.isTemplateLinked).toBe(true);
      expect(linked?.metadata.isPropagationLocked).toBe(false);

      expect(locked?.metadata.isTemplateLinked).toBe(true);
      expect(locked?.metadata.isPropagationLocked).toBe(true);

      expect(manual?.metadata.isTemplateLinked).toBe(false);
      expect(manual?.metadata.isPropagationLocked).toBe(false);
    });
  });
});
