import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BudgetTableDataProvider } from './budget-table-data-provider';
import { BudgetCalculator } from '@core/budget/budget-calculator';
import type { BudgetLine } from '@pulpe/shared';
import {
  createMockBudgetLine,
  createMockRolloverBudgetLine,
} from '../../../../testing/mock-factories';

describe('BudgetTableDataProvider - Rollover Functionality', () => {
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

  describe('Rollover Line Handling', () => {
    it('should identify and mark rollover lines', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'regular-line',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
          budgetId: 'budget-1',
          templateLineId: 'line-1',
        }),
        createMockRolloverBudgetLine({
          id: 'rollover-line',
          name: 'rollover_12_2024',
          amount: 150,
          budgetId: 'budget-1',
          templateLineId: 'line-2',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      expect(result.items).toHaveLength(2);

      const rolloverItem = result.items.find((item) =>
        item.data.name.includes('rollover'),
      );
      const regularItem = result.items.find(
        (item) => !item.data.name.includes('rollover'),
      );

      expect(rolloverItem?.metadata.isRollover).toBe(true);
      expect(rolloverItem?.metadata.isEditing).toBe(false); // Rollover lines can't be edited
      expect(regularItem?.metadata.isRollover).toBe(false);
    });

    it('should prevent editing of rollover lines even when editingLineId matches', () => {
      const budgetLines: BudgetLine[] = [
        createMockRolloverBudgetLine({
          id: 'rollover-line',
          name: 'rollover_12_2024',
          amount: 150,
          budgetId: 'budget-1',
          templateLineId: 'line-1',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: 'rollover-line', // Try to edit rollover line
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].metadata.isRollover).toBe(true);
      expect(result.items[0].metadata.isEditing).toBe(false); // Should not be editable
    });

    it('should allow editing of regular lines when not rollover', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'regular-line',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
          budgetId: 'budget-1',
          templateLineId: 'line-1',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: 'regular-line',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].metadata.isRollover).toBe(false);
      expect(result.items[0].metadata.isEditing).toBe(true); // Should be editable
    });

    it('should properly sort rollover lines with regular lines', () => {
      const budgetLines: BudgetLine[] = [
        // Regular expense (fixed)
        createMockBudgetLine({
          id: 'expense-line',
          name: 'Regular Expense',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
          budgetId: 'budget-1',
          templateLineId: 'line-1',
        }),
        // Rollover income (one_off recurrence by default)
        createMockRolloverBudgetLine({
          id: 'rollover-income',
          name: 'rollover_12_2024',
          amount: 150,
          budgetId: 'budget-1',
          templateLineId: 'line-2',
          kind: 'income',
        }),
        // Regular income (fixed)
        createMockBudgetLine({
          id: 'income-line',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          budgetId: 'budget-1',
          templateLineId: 'line-3',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      expect(result.items).toHaveLength(3);

      // Sorting logic: 1. budget_lines before transactions, 2. recurrence (fixed before one_off), 3. kind (income → saving → expense)
      // Expected order: Fixed income, Fixed expense, One-off income (rollover)
      expect(result.items[0].data.name).toBe('Salary'); // Fixed income
      expect(result.items[0].data.kind).toBe('income');
      expect(result.items[1].data.name).toBe('Regular Expense'); // Fixed expense
      expect(result.items[1].data.kind).toBe('expense');
      expect(result.items[2].data.name).toBe('rollover_12_2024'); // One-off income (rollover)
      expect(result.items[2].data.kind).toBe('income');
      expect(result.items[2].metadata.isRollover).toBe(true);
    });

    it('should handle mixed rollover and regular lines with cumulative balances', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: 'salary',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          budgetId: 'budget-1',
          templateLineId: 'line-1',
        }),
        createMockRolloverBudgetLine({
          id: 'rollover',
          name: 'rollover_12_2024',
          amount: 200,
          budgetId: 'budget-1',
          templateLineId: 'line-2',
          kind: 'income',
        }),
        createMockBudgetLine({
          id: 'rent',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
          budgetId: 'budget-1',
          templateLineId: 'line-3',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      expect(result.items).toHaveLength(3);

      // All items should have cumulative balance calculated
      result.items.forEach((item) => {
        expect(typeof item.metadata.cumulativeBalance).toBe('number');
      });

      // Sorting order: Fixed income (Salary), Fixed expense (Rent), One-off income (Rollover)
      expect(result.items[0].data.name).toBe('Salary');
      expect(result.items[1].data.name).toBe('Rent');
      expect(result.items[2].data.name).toBe('rollover_12_2024');

      // Cumulative balance calculation based on sorted order
      expect(result.items[0].metadata.cumulativeBalance).toBe(5000); // Salary: +5000
      expect(result.items[1].metadata.cumulativeBalance).toBe(3500); // Rent: 5000 - 1500 = 3500
      expect(result.items[2].metadata.cumulativeBalance).toBe(3700); // Rollover: 3500 + 200 = 3700
    });
  });
});
