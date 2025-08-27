import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BudgetTableMapper } from './budget-table-mapper';
import { BudgetCalculator } from '@core/budget/budget-calculator';
import { type BudgetLine, type Transaction } from '@pulpe/shared';

describe('BudgetTableMapper - Rollover Functionality', () => {
  let mapper: BudgetTableMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BudgetTableMapper,
        BudgetCalculator,
        provideZonelessChangeDetection(),
      ],
    });
    mapper = TestBed.inject(BudgetTableMapper);
  });

  describe('Rollover Line Display', () => {
    it('should identify and mark rollover lines', () => {
      // Arrange
      const rolloverLine: BudgetLine = {
        id: 'rollover-budget-123',
        budgetId: 'budget-123',
        templateLineId: null,
        savingsGoalId: null,
        name: 'rollover_1_2025',
        amount: 500,
        kind: 'income',
        recurrence: 'one_off',
        isManuallyAdjusted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const regularLine: BudgetLine = {
        id: 'regular-line-456',
        budgetId: 'budget-123',
        templateLineId: 'template-line-1',
        savingsGoalId: null,
        name: 'Salary',
        amount: 5000,
        kind: 'income',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const budgetLines = [regularLine, rolloverLine];
      const transactions: Transaction[] = [];
      const operationsInProgress = new Set<string>();

      // Act
      const result = mapper.prepareBudgetTableData(
        budgetLines,
        transactions,
        operationsInProgress,
        null,
      );

      // Assert
      const rolloverRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === 'rollover-budget-123',
      );
      const regularRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === 'regular-line-456',
      );

      expect(rolloverRow).toBeDefined();
      expect(rolloverRow?.isRollover).toBe(true);
      expect(rolloverRow?.name).toBe('Report janvier 2025'); // Check formatting
      expect(regularRow?.isRollover).toBe(false);
    });

    it('should position rollover line at the end of budget lines', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        {
          id: 'line-1',
          budgetId: 'budget-123',
          templateLineId: 'template-1',
          savingsGoalId: null,
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'line-2',
          budgetId: 'budget-123',
          templateLineId: 'template-2',
          savingsGoalId: null,
          name: 'Rent',
          amount: 2000,
          kind: 'expense',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'rollover-budget-123',
          budgetId: 'budget-123',
          templateLineId: null,
          savingsGoalId: null,
          name: 'rollover_2_2025',
          amount: 350,
          kind: 'income',
          recurrence: 'one_off',
          isManuallyAdjusted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'line-3',
          budgetId: 'budget-123',
          templateLineId: 'template-3',
          savingsGoalId: null,
          name: 'Extra expense',
          amount: 100,
          kind: 'expense',
          recurrence: 'one_off',
          isManuallyAdjusted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const transactions: Transaction[] = [];
      const operationsInProgress = new Set<string>();

      // Act
      const result = mapper.prepareBudgetTableData(
        budgetLines,
        transactions,
        operationsInProgress,
        null,
      );

      // Assert
      const dataRows = result.rows.filter((row) => row.type === 'data_row');
      const rolloverIndex = dataRows.findIndex(
        (row) => row.id === 'rollover-budget-123',
      );
      const lastBudgetLineIndex = dataRows.findIndex(
        (row) => row.id === 'line-3',
      );

      // Rollover should come after the last regular budget line
      expect(rolloverIndex).toBeGreaterThan(lastBudgetLineIndex);
    });

    it('should not allow editing of rollover lines', () => {
      // Arrange
      const rolloverLine: BudgetLine = {
        id: 'rollover-budget-123',
        budgetId: 'budget-123',
        templateLineId: null,
        savingsGoalId: null,
        name: 'rollover_3_2025',
        amount: 0,
        kind: 'income',
        recurrence: 'one_off',
        isManuallyAdjusted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const budgetLines = [rolloverLine];
      const transactions: Transaction[] = [];
      const operationsInProgress = new Set<string>();
      const editingLineId = 'rollover-budget-123'; // Try to edit the rollover line

      // Act
      const result = mapper.prepareBudgetTableData(
        budgetLines,
        transactions,
        operationsInProgress,
        editingLineId,
      );

      // Assert
      const rolloverRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === 'rollover-budget-123',
      );

      expect(rolloverRow?.isEditing).toBe(false); // Should not be editable
      expect(rolloverRow?.isRollover).toBe(true);
    });

    it('should handle negative rollover as expense', () => {
      // Arrange
      const rolloverLine: BudgetLine = {
        id: 'rollover-budget-123',
        budgetId: 'budget-123',
        templateLineId: null,
        savingsGoalId: null,
        name: 'rollover_4_2025',
        amount: 200,
        kind: 'expense', // Negative rollover
        recurrence: 'one_off',
        isManuallyAdjusted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const budgetLines = [rolloverLine];
      const transactions: Transaction[] = [];
      const operationsInProgress = new Set<string>();

      // Act
      const result = mapper.prepareBudgetTableData(
        budgetLines,
        transactions,
        operationsInProgress,
        null,
      );

      // Assert
      const rolloverRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === 'rollover-budget-123',
      );

      expect(rolloverRow?.kind).toBe('expense');
      expect(rolloverRow?.kindIcon).toBe('trending_down');
      expect(rolloverRow?.kindLabel).toBe('Dépense');
      expect(rolloverRow?.amountClass).toBe('text-financial-negative');
    });

    it('should handle zero rollover correctly', () => {
      // Arrange
      const rolloverLine: BudgetLine = {
        id: 'rollover-budget-123',
        budgetId: 'budget-123',
        templateLineId: null,
        savingsGoalId: null,
        name: 'rollover_5_2025',
        amount: 0,
        kind: 'income', // Zero is considered positive
        recurrence: 'one_off',
        isManuallyAdjusted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const budgetLines = [rolloverLine];
      const transactions: Transaction[] = [];
      const operationsInProgress = new Set<string>();

      // Act
      const result = mapper.prepareBudgetTableData(
        budgetLines,
        transactions,
        operationsInProgress,
        null,
      );

      // Assert
      const rolloverRow = result.rows.find(
        (row) => row.type === 'data_row' && row.id === 'rollover-budget-123',
      );

      expect(rolloverRow?.amount).toBe(0);
      expect(rolloverRow?.kind).toBe('income');
      expect(rolloverRow?.isRollover).toBe(true);
    });
  });

  describe('Integration with existing budget lines', () => {
    it('should maintain proper cumulative balance with rollover', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        {
          id: 'income-1',
          budgetId: 'budget-123',
          templateLineId: 'template-1',
          savingsGoalId: null,
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'rollover-budget-123',
          budgetId: 'budget-123',
          templateLineId: null,
          savingsGoalId: null,
          name: 'rollover_6_2025',
          amount: 500,
          kind: 'income',
          recurrence: 'one_off',
          isManuallyAdjusted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'expense-1',
          budgetId: 'budget-123',
          templateLineId: 'template-2',
          savingsGoalId: null,
          name: 'Rent',
          amount: 2000,
          kind: 'expense',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const transactions: Transaction[] = [];
      const operationsInProgress = new Set<string>();

      // Act
      const result = mapper.prepareBudgetTableData(
        budgetLines,
        transactions,
        operationsInProgress,
        null,
      );

      // Assert
      const dataRows = result.rows.filter((row) => row.type === 'data_row');
      const rolloverRow = dataRows.find(
        (row) => row.id === 'rollover-budget-123',
      );

      // The rollover should be included in cumulative balance calculations
      expect(rolloverRow).toBeDefined();
      expect(rolloverRow?.cumulativeBalance).toBeDefined();
    });
  });
});
