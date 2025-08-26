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
      const result = service.prepareBudgetTableData([], [], new Set(), null);

      expect(result).toEqual({
        rows: [],
        hasOneOffItems: false,
        hasTransactions: false,
        isEmpty: true,
      });
    });

    it('should prepare table data with fixed budget lines only', () => {
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
        {
          id: '2',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'line-2',
        },
      ];

      const result = service.prepareBudgetTableData(
        budgetLines,
        [],
        new Set(),
        null,
      );

      expect(result.rows.length).toBe(2);
      expect(result.hasOneOffItems).toBe(false);
      expect(result.hasTransactions).toBe(false);
      expect(result.isEmpty).toBe(false);

      // Check that all rows are data rows (no section headers for fixed items)
      const dataRows = result.rows.filter((row) => row.type === 'data_row');
      expect(dataRows.length).toBe(2);
    });

    it('should add section header for one-off budget lines', () => {
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
        {
          id: '2',
          name: 'Bonus',
          amount: 1000,
          kind: 'income',
          recurrence: 'one_off',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'line-2',
        },
      ];

      const result = service.prepareBudgetTableData(
        budgetLines,
        [],
        new Set(),
        null,
      );

      expect(result.hasOneOffItems).toBe(true);
      expect(result.hasTransactions).toBe(false);

      // Find the section header
      const sectionHeader = result.rows.find(
        (row) => row.type === 'section_header' && row.id === 'one-off-header',
      );
      expect(sectionHeader).toBeDefined();
      expect(sectionHeader?.title).toBe('Une seule fois');
    });

    it('should add section header for transactions', () => {
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

      const result = service.prepareBudgetTableData(
        [],
        transactions,
        new Set(),
        null,
      );

      expect(result.hasOneOffItems).toBe(false);
      expect(result.hasTransactions).toBe(true);

      // Find the transaction section header
      const sectionHeader = result.rows.find(
        (row) =>
          row.type === 'section_header' && row.id === 'transactions-header',
      );
      expect(sectionHeader).toBeDefined();
      expect(sectionHeader?.title).toBe('Ajouté durant le mois');
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

      const result = service.prepareBudgetTableData(
        budgetLines,
        [],
        new Set(),
        'line-1', // editing this line
      );

      const dataRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === 'line-1',
      );
      expect(dataRow?.isEditing).toBe(true);
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

      const operationsInProgress = new Set(['line-1']);
      const result = service.prepareBudgetTableData(
        budgetLines,
        [],
        operationsInProgress,
        null,
      );

      const dataRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === 'line-1',
      );
      expect(dataRow?.isLoading).toBe(true);
    });

    it('should apply correct styling classes based on transaction kind', () => {
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
        {
          id: '2',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'line-2',
        },
        {
          id: '3',
          name: 'Savings',
          amount: 500,
          kind: 'saving',
          recurrence: 'fixed',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'line-3',
        },
      ];

      const result = service.prepareBudgetTableData(
        budgetLines,
        [],
        new Set(),
        null,
      );

      const incomeRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === '1',
      );
      const expenseRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === '2',
      );
      const savingRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === '3',
      );

      expect(incomeRow?.kindIcon).toBe('trending_up');
      expect(incomeRow?.kindIconClass).toBe('text-financial-income');
      expect(incomeRow?.amountClass).toBe('text-financial-income');

      expect(expenseRow?.kindIcon).toBe('trending_down');
      expect(expenseRow?.kindIconClass).toBe('text-financial-negative');
      expect(expenseRow?.amountClass).toBe('text-financial-negative');

      expect(savingRow?.kindIcon).toBe('savings');
      expect(savingRow?.kindIconClass).toBe('text-primary');
      expect(savingRow?.amountClass).toBe('text-primary');
    });
  });

  describe('calculateBudgetSummary', () => {
    it('should calculate correct budget summary', () => {
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
        {
          id: '2',
          name: 'Rent',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'line-2',
        },
        {
          id: '3',
          name: 'Savings',
          amount: 500,
          kind: 'saving',
          recurrence: 'fixed',
          templateId: 'template-1',
          budgetId: 'budget-1',
          templateLineId: 'line-3',
        },
      ];

      const summary = service.calculateBudgetSummary(budgetLines);

      expect(summary.plannedIncome).toBe(5000);
      expect(summary.fixedBlock).toBe(2000); // 1500 + 500
      expect(summary.livingAllowance).toBe(3000); // 5000 - 2000
    });
  });
});
