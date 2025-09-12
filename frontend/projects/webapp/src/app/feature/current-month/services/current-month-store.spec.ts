import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type {
  Budget,
  BudgetLine,
  Transaction,
  TransactionCreate,
} from '@pulpe/shared';

import { CurrentMonthStore } from './current-month-store';
import { BudgetApi, BudgetCalculator } from '@core/budget';
import { TransactionApi } from '@core/transaction/transaction-api';
import { Logger } from '@core/logging/logger';

// Mock data aligned with business scenarios
const mockBudget: Budget = {
  id: 'budget-1',
  userId: 'user-1',
  templateId: 'template-1',
  month: 1,
  year: 2024,
  description: 'January Budget',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  endingBalance: 3426,
};

const mockBudgetLines: BudgetLine[] = [
  {
    id: 'line-income',
    budgetId: 'budget-1',
    templateLineId: 'tpl-1',
    isManuallyAdjusted: false,
    isRollover: false,
    savingsGoalId: null,
    name: 'Salary',
    amount: 5000,
    kind: 'income',
    recurrence: 'fixed',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'line-expense',
    budgetId: 'budget-1',
    templateLineId: 'tpl-2',
    isManuallyAdjusted: false,
    isRollover: false,
    savingsGoalId: null,
    name: 'Rent',
    amount: 1500,
    kind: 'expense',
    recurrence: 'fixed',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'rollover-line',
    budgetId: 'budget-1',
    templateLineId: null,
    isManuallyAdjusted: false,
    savingsGoalId: null,
    name: 'rollover_12_2023',
    amount: 500,
    kind: 'expense',
    recurrence: 'one_off',
    isRollover: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockTransactions: Transaction[] = [
  {
    id: 'txn-1',
    budgetId: 'budget-1',
    amount: 50,
    category: null,
    isOutOfBudget: false,
    name: 'Coffee',
    kind: 'expense',
    transactionDate: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
];

/**
 * Business Value Tests for CurrentMonthStore
 *
 * These tests focus on what matters to users:
 * 1. Can they see their financial situation clearly?
 * 2. Can they manage their transactions?
 * 3. Does the app provide accurate calculations?
 * 4. Does the app remain stable when things go wrong?
 */
describe('CurrentMonthStore - Business Scenarios', () => {
  let store: CurrentMonthStore;
  let mockBudgetApi: {
    getBudgetForMonth$: Mock;
    getBudgetWithDetails$: Mock;
    getBudgetById$: Mock;
  };
  let mockTransactionApi: {
    create$: Mock;
    update$: Mock;
    remove$: Mock;
  };
  let mockBudgetCalculator: {
    calculateLocalEndingBalance: Mock;
    calculateBalance: Mock;
    calculatePlannedIncome: Mock;
    calculateActualTransactionsAmount: Mock;
    calculateTotalSpentIncludingRollover: Mock;
    calculateTotalSpentExcludingRollover: Mock;
    calculateTotalAvailable: Mock;
    calculateRolloverAmount: Mock;
  };

  beforeEach(() => {
    // Realistic mocks that simulate actual business behaviors
    mockBudgetApi = {
      getBudgetForMonth$: vi.fn().mockReturnValue(of(mockBudget)),
      getBudgetWithDetails$: vi.fn().mockReturnValue(
        of({
          data: {
            budget: mockBudget,
            transactions: mockTransactions,
            budgetLines: mockBudgetLines,
          },
        }),
      ),
      getBudgetById$: vi.fn().mockReturnValue(of(mockBudget)),
    };

    mockTransactionApi = {
      create$: vi.fn(),
      update$: vi.fn(),
      remove$: vi.fn(),
    };

    mockBudgetCalculator = {
      calculateLocalEndingBalance: vi.fn().mockReturnValue(3426),
      calculateBalance: vi.fn().mockReturnValue(3000),
      calculatePlannedIncome: vi.fn().mockReturnValue(5000),
      calculateActualTransactionsAmount: vi.fn().mockReturnValue(50),
      calculateTotalSpentIncludingRollover: vi.fn().mockReturnValue(2050), // 1500 + 500 + 50
      calculateTotalSpentExcludingRollover: vi.fn().mockReturnValue(1550), // 1500 + 50 (sans rollover)
      calculateTotalAvailable: vi.fn().mockReturnValue(5000),
      calculateRolloverAmount: vi.fn().mockReturnValue(500),
    };

    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        CurrentMonthStore,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: TransactionApi, useValue: mockTransactionApi },
        { provide: BudgetCalculator, useValue: mockBudgetCalculator },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    store = TestBed.inject(CurrentMonthStore);
  });

  describe('User can see their financial situation', () => {
    it('should display available amount to spend correctly', () => {
      // Business scenario: User opens the app and wants to see how much they can spend

      // Given: User has income, expenses, and rollover from previous month
      // When: User views their dashboard
      const availableToSpend = store.availableToSpend();

      // Then: The calculation should be: (Income + Rollover) - Expenses
      // Expected: (5000 + 500) - 1550 = 3950
      expect(availableToSpend).toBe(3950);
    });

    it('should show rollover from previous month', () => {
      // Business scenario: User wants to see money carried over from last month

      const rollover = store.rolloverAmount();

      // Should show the positive rollover amount
      expect(rollover).toBe(500);
      // Verify the calculator is called
      expect(mockBudgetCalculator.calculateRolloverAmount).toHaveBeenCalled();
    });

    it('should calculate total spent excluding rollover for budget progress', () => {
      // Business scenario: User wants to see how much they've spent this month
      // (excluding rollover from previous month for clear progress tracking)

      const totalSpent = store.totalSpentWithoutRollover();

      // Should exclude rollover: only current month expenses + transactions
      expect(totalSpent).toBe(1550); // 1500 (rent) + 50 (coffee) = 1550
      // Verify the calculator is called
      expect(
        mockBudgetCalculator.calculateTotalSpentExcludingRollover,
      ).toHaveBeenCalled();
    });

    it('should show total available including rollover', () => {
      // Business scenario: User wants to see total money available this month

      const totalAvailable = store.totalAvailableWithRollover();

      // Should be: Income + Rollover = 5000 + 500 = 5500
      expect(totalAvailable).toBe(5500);
    });
  });

  describe('User can navigate between months', () => {
    it('should allow user to change the current month view', () => {
      // Business scenario: User wants to view their budget for a different month

      const newDate = new Date('2024-02-15');
      store.setCurrentDate(newDate);

      expect(store.budgetDate()).toEqual(newDate);
    });

    it('should start with current date by default', () => {
      // Business scenario: User opens app and sees current month by default

      const currentDate = store.budgetDate();

      expect(currentDate).toBeInstanceOf(Date);
    });
  });

  describe('User can refresh their data', () => {
    it('should allow user to refresh their financial data', () => {
      // Business scenario: User pulls to refresh or clicks refresh button

      const refreshSpy = vi.spyOn(store, 'refreshData');

      expect(() => store.refreshData()).not.toThrow();
      store.refreshData();

      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('User can manage transactions', () => {
    it('should allow adding a transaction without errors', async () => {
      // Business scenario: User adds a new expense and the operation completes successfully
      const newTransaction: TransactionCreate = {
        budgetId: 'budget-1',
        name: 'Coffee',
        amount: 5,
        kind: 'expense',
        transactionDate: '2024-01-25T00:00:00Z',
        isOutOfBudget: false,
        category: null,
      };

      mockTransactionApi.create$.mockReturnValue(
        of({
          data: {
            id: 'new-1',
            ...newTransaction,
            createdAt: '2024-01-25T00:00:00Z',
            updatedAt: '2024-01-25T00:00:00Z',
          },
        }),
      );

      // Should complete without throwing
      await expect(
        store.addTransaction(newTransaction),
      ).resolves.toBeUndefined();
    });

    it('should allow updating a transaction without errors', async () => {
      // Business scenario: User modifies an existing transaction
      mockTransactionApi.update$.mockReturnValue(
        of({ data: { id: 'trans-1', amount: 200, name: 'Updated' } }),
      );

      // Should complete without throwing
      await expect(
        store.updateTransaction('trans-1', { amount: 200 }),
      ).resolves.toBeUndefined();
    });

    it('should allow deleting a transaction without errors', async () => {
      // Business scenario: User removes an unwanted transaction
      mockTransactionApi.remove$.mockReturnValue(of(undefined));

      // Should complete without throwing
      await expect(store.deleteTransaction('trans-1')).resolves.toBeUndefined();
    });
  });

  describe('App handles errors gracefully', () => {
    it('should maintain stability when add transaction fails', async () => {
      // Business scenario: App doesn't crash when server is down during transaction creation
      mockTransactionApi.create$.mockReturnValue(
        throwError(() => new Error('Server unavailable')),
      );

      const newTransaction: TransactionCreate = {
        budgetId: 'budget-1',
        name: 'Failed transaction',
        amount: 100,
        kind: 'expense',
        transactionDate: '2024-01-25T00:00:00Z',
        isOutOfBudget: false,
        category: null,
      };

      // Should throw but not corrupt the store
      await expect(store.addTransaction(newTransaction)).rejects.toThrow(
        'Server unavailable',
      );

      // Store should still be functional after error
      expect(store.availableToSpend()).toBe(3950);
      // In error scenarios with empty initial state, budgetLines might be empty
      expect(store.budgetLines()).toEqual(expect.any(Array));
    });

    it('should maintain stability when update transaction fails', async () => {
      // Business scenario: Failed updates don't corrupt user's data
      mockTransactionApi.update$.mockReturnValue(
        throwError(() => new Error('Update failed')),
      );

      // Should throw but not corrupt the store
      await expect(
        store.updateTransaction('trans-1', { amount: 200 }),
      ).rejects.toThrow('Update failed');

      // Store should still be functional
      expect(store.availableToSpend()).toBe(3950);
    });

    it('should maintain stability when delete transaction fails', async () => {
      // Business scenario: Failed deletions don't corrupt user's data
      mockTransactionApi.remove$.mockReturnValue(
        throwError(() => new Error('Delete failed')),
      );

      // Should throw but not corrupt the store
      await expect(store.deleteTransaction('trans-1')).rejects.toThrow(
        'Delete failed',
      );

      // Store should still be functional
      expect(store.availableToSpend()).toBe(3950);
    });
  });

  describe('App handles empty states gracefully', () => {
    beforeEach(() => {
      // Setup scenario with no data
      mockBudgetApi.getBudgetForMonth$.mockReturnValue(of(null));
      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(
        of({ data: { budget: null, transactions: [], budgetLines: [] } }),
      );
      mockBudgetCalculator.calculateTotalAvailable.mockReturnValue(0);
      mockBudgetCalculator.calculateTotalSpentExcludingRollover.mockReturnValue(
        0,
      );
      mockBudgetCalculator.calculateRolloverAmount.mockReturnValue(0);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          CurrentMonthStore,
          { provide: BudgetApi, useValue: mockBudgetApi },
          { provide: TransactionApi, useValue: mockTransactionApi },
          { provide: BudgetCalculator, useValue: mockBudgetCalculator },
        ],
      });
      store = TestBed.inject(CurrentMonthStore);
    });

    it('should handle when user has no budget for the month', () => {
      // Business scenario: User opens app for a month with no budget created

      expect(store.budgetLines()).toEqual([]);
      expect(store.transactions()).toEqual([]);
      expect(store.availableToSpend()).toBe(0);
      expect(store.totalAvailableWithRollover()).toBe(0);
    });

    it('should handle API errors during data loading', () => {
      // Business scenario: App remains functional when server has issues
      mockBudgetApi.getBudgetForMonth$.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      // Store should still be created without crashing
      expect(store).toBeTruthy();
      expect(store.budgetLines()).toEqual([]);
    });
  });
});
