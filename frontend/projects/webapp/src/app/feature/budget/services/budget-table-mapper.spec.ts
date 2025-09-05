import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BudgetTableMapper } from './budget-table-mapper';
import { BudgetCalculator } from '@core/budget/budget-calculator';
import type { BudgetLine, Transaction } from '@pulpe/shared';

describe('BudgetTableMapper', () => {
  let service: BudgetTableMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BudgetTableMapper,
        BudgetCalculator,
        provideZonelessChangeDetection(),
      ],
    });

    service = TestBed.inject(BudgetTableMapper);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('prepareBudgetTableData', () => {
    it('should prepare empty table data when no items exist', () => {
      const result = service.prepareBudgetTableData({
        budgetLines: [],
        transactions: [],
        operationsInProgress: new Set(),
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

    it('should prepare table data with budget lines', () => {
      const budgetLines: BudgetLine[] = [
        {
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'line-1',
        },
      ];

      const result = service.prepareBudgetTableData({
        budgetLines,
        transactions: [],
        operationsInProgress: new Set(),
        editingLineId: null,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        data: {
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
        },
        metadata: {
          itemType: 'budget_line',
          isEditing: false,
          isLoading: false,
          isRollover: false,
        },
      });
      expect(result.summary.hasOneOff).toBe(false);
      expect(result.summary.hasTransactions).toBe(false);
      expect(result.summary.isEmpty).toBe(false);
    });

    it('should detect one-off items', () => {
      const budgetLines: BudgetLine[] = [
        {
          id: '1',
          name: 'Bonus',
          amount: 1000,
          kind: 'income',
          recurrence: 'one_off',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'line-1',
        },
      ];

      const result = service.prepareBudgetTableData({
        budgetLines,
        transactions: [],
        operationsInProgress: new Set(),
        editingLineId: null,
      });

      expect(result.summary.hasOneOff).toBe(true);
    });

    it('should detect transactions', () => {
      const transactions: Transaction[] = [
        {
          id: 'trans-1',
          name: 'Coffee',
          amount: 5,
          kind: 'expense',
          date: '2024-01-15',
          budgetId: 'budget-1',
          userId: 'user-1',
        },
      ];

      const result = service.prepareBudgetTableData({
        budgetLines: [],
        transactions,
        operationsInProgress: new Set(),
        editingLineId: null,
      });

      expect(result.summary.hasTransactions).toBe(true);
    });

    it('should mark item as editing when editingLineId matches', () => {
      const budgetLines: BudgetLine[] = [
        {
          id: 'line-1',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'template-line-1',
        },
      ];

      const result = service.prepareBudgetTableData({
        budgetLines,
        transactions: [],
        operationsInProgress: new Set(),
        editingLineId: 'line-1',
      });

      expect(result.items[0].metadata.isEditing).toBe(true);
    });

    it('should mark item as loading when in operationsInProgress', () => {
      const budgetLines: BudgetLine[] = [
        {
          id: 'line-1',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'template-line-1',
        },
      ];

      const result = service.prepareBudgetTableData({
        budgetLines,
        transactions: [],
        operationsInProgress: new Set(['line-1']),
        editingLineId: null,
      });

      expect(result.items[0].metadata.isLoading).toBe(true);
    });

    it('should identify rollover lines', () => {
      const budgetLines: BudgetLine[] = [
        {
          id: '1',
          name: 'rollover_12_2024',
          amount: 150,
          kind: 'income',
          recurrence: 'one_off',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'line-1',
          isRollover: true,
        },
      ];

      const result = service.prepareBudgetTableData({
        budgetLines,
        transactions: [],
        operationsInProgress: new Set(),
        editingLineId: null,
      });

      expect(result.items[0].metadata.isRollover).toBe(true);
    });
  });
});
