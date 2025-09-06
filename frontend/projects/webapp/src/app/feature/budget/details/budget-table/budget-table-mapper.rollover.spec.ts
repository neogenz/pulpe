import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BudgetTableMapper } from './budget-table-mapper';
import { BudgetCalculator } from '@core/budget/budget-calculator';
import type { BudgetLine } from '@pulpe/shared';
import {
  createMockBudgetLine,
  createMockRolloverBudgetLine,
} from '../../../../testing/mock-factories';

describe('BudgetTableMapper - Rollover Functionality', () => {
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

      const result = service.prepareBudgetTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      const rolloverItem = result.items.find(
        (item) => item.data.id === 'rollover-line',
      );
      const regularItem = result.items.find(
        (item) => item.data.id === 'regular-line',
      );

      expect(rolloverItem?.metadata.isRollover).toBe(true);
      expect(regularItem?.metadata.isRollover).toBe(false);
    });

    it('should not allow editing of rollover lines', () => {
      const budgetLines: BudgetLine[] = [
        createMockRolloverBudgetLine({
          id: 'rollover-line',
          name: 'rollover_12_2024',
          amount: 150,
          budgetId: 'budget-1',
          templateLineId: 'line-1',
        }),
      ];

      const result = service.prepareBudgetTableData({
        budgetLines,
        transactions: [],
        editingLineId: 'rollover-line',
      });

      const rolloverItem = result.items.find(
        (item) => item.data.id === 'rollover-line',
      );

      // Rollover lines should not be marked as editing even if editingLineId matches
      expect(rolloverItem?.metadata.isEditing).toBe(false);
    });

    it('should handle different rollover amounts correctly', () => {
      const budgetLines: BudgetLine[] = [
        createMockRolloverBudgetLine({
          id: 'positive-rollover',
          name: 'rollover_11_2024',
          amount: 200,
          budgetId: 'budget-1',
          templateLineId: 'line-1',
        }),
        createMockBudgetLine({
          id: 'negative-rollover',
          name: 'rollover_10_2024',
          amount: 50,
          kind: 'expense',
          recurrence: 'one_off',
          budgetId: 'budget-1',
          templateLineId: 'line-2',
          isRollover: true,
        }),
      ];

      const result = service.prepareBudgetTableData({
        budgetLines,
        transactions: [],
        editingLineId: null,
      });

      const positiveRollover = result.items.find(
        (item) => item.data.id === 'positive-rollover',
      );
      const negativeRollover = result.items.find(
        (item) => item.data.id === 'negative-rollover',
      );

      expect(positiveRollover?.data.kind).toBe('income');
      expect(negativeRollover?.data.kind).toBe('expense');
      expect(positiveRollover?.metadata.isRollover).toBe(true);
      expect(negativeRollover?.metadata.isRollover).toBe(true);
    });
  });
});
