import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BudgetTableDataProvider } from './budget-table-data-provider';
import { BudgetCalculator } from '@core/budget/budget-calculator';
import type { BudgetLine, Transaction } from '@pulpe/shared';
import {
  createMockBudgetLine,
  createMockTransaction,
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

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('provideTableData', () => {
    it('should provide empty table data when no items exist', () => {
      const result = service.provideTableData({
        budgetLines: [],
        transactions: [],
        editingLineId: null,
      });

      expect(result).toEqual({
        items: [],
        summary: {
          hasOneOff: false,
          hasTransactions: false,
          isEmpty: true,
        },
      });
    });

    it('should provide table data with budget lines', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
        createMockBudgetLine({
          id: '2',
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].data.name).toBe('Salary');
      expect(result.items[0].metadata.itemType).toBe('budget_line');
      expect(result.items[1].data.name).toBe('Groceries');
      expect(result.summary.hasOneOff).toBe(false);
      expect(result.summary.hasTransactions).toBe(false);
      expect(result.summary.isEmpty).toBe(false);
    });

    it('should provide table data with transactions', () => {
      const transactions: Transaction[] = [
        createMockTransaction({
          id: '1',
          name: 'Coffee',
          amount: 5,
          kind: 'expense',
        }),
      ];

      const result = service.provideTableData({
        budgetLines: [],
        transactions,
        editingLineId: null,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].data.name).toBe('Coffee');
      expect(result.items[0].metadata.itemType).toBe('transaction');
      expect(result.summary.hasTransactions).toBe(true);
      expect(result.summary.isEmpty).toBe(false);
    });

    it('should detect one-off budget lines in summary', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: '1',
          name: 'Bonus',
          amount: 1000,
          kind: 'income',
          recurrence: 'one_off',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      expect(result.summary.hasOneOff).toBe(true);
    });

    it('should mark editing item correctly', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: '1',
      });

      expect(result.items[0].metadata.isEditing).toBe(true);
    });

    it('should not allow editing rollover lines', () => {
      const budgetLines: BudgetLine[] = [
        createMockBudgetLine({
          id: '1',
          name: 'Rollover',
          amount: 500,
          kind: 'income',
          recurrence: 'fixed',
          isRollover: true,
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions: [],
        editingLineId: '1',
      });

      expect(result.items[0].metadata.isEditing).toBe(false);
      expect(result.items[0].metadata.isRollover).toBe(true);
    });

    it('should sort items by business rules', () => {
      const budgetLines: BudgetLine[] = [
        // One-off expense (should come after fixed)
        createMockBudgetLine({
          id: '1',
          name: 'One-off expense',
          amount: 100,
          kind: 'expense',
          recurrence: 'one_off',
        }),
        // Fixed income (should come first)
        createMockBudgetLine({
          id: '2',
          name: 'Fixed income',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
        }),
        // Fixed saving (should come second)
        createMockBudgetLine({
          id: '3',
          name: 'Fixed saving',
          amount: 1000,
          kind: 'saving',
          recurrence: 'fixed',
        }),
        // Fixed expense (should come third)
        createMockBudgetLine({
          id: '4',
          name: 'Fixed expense',
          amount: 500,
          kind: 'expense',
          recurrence: 'fixed',
        }),
      ];

      const transactions: Transaction[] = [
        // Transaction should come last
        createMockTransaction({
          id: '5',
          name: 'Transaction expense',
          amount: 50,
          kind: 'expense',
        }),
      ];

      const result = service.provideTableData({
        budgetLines,
        transactions,
        editingLineId: null,
      });

      expect(result.items).toHaveLength(5);
      // Order should be: Fixed income, Fixed saving, Fixed expense, One-off expense, Transaction
      expect(result.items[0].data.name).toBe('Fixed income');
      expect(result.items[1].data.name).toBe('Fixed saving');
      expect(result.items[2].data.name).toBe('Fixed expense');
      expect(result.items[3].data.name).toBe('One-off expense');
      expect(result.items[4].data.name).toBe('Transaction expense');
    });
  });
});
