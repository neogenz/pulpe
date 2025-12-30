import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
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
import { ApplicationConfiguration } from '@core/config/application-configuration';

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
  rollover: 500, // Rollover from previous month (December 2023)
};

const mockBudgetLines: BudgetLine[] = [
  {
    id: 'line-income',
    budgetId: 'budget-1',
    templateLineId: 'tpl-1',
    isManuallyAdjusted: false,
    savingsGoalId: null,
    name: 'Salary',
    amount: 5000,
    kind: 'income',
    recurrence: 'fixed',
    checkedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'line-expense',
    budgetId: 'budget-1',
    templateLineId: 'tpl-2',
    isManuallyAdjusted: false,
    savingsGoalId: null,
    name: 'Rent',
    amount: 1500,
    kind: 'expense',
    recurrence: 'fixed',
    checkedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  // Note: Rollover is now stored on Budget.rollover, not as a budget line
];

const mockTransactions: Transaction[] = [
  {
    id: 'txn-1',
    budgetId: 'budget-1',
    budgetLineId: null,
    amount: 50,
    category: null,
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
    calculatePlannedIncome: Mock;
    calculateActualTransactionsAmount: Mock;
    calculateTotalAvailable: Mock;
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
      calculatePlannedIncome: vi.fn().mockReturnValue(5000),
      calculateActualTransactionsAmount: vi.fn().mockReturnValue(50),
      calculateTotalAvailable: vi.fn().mockReturnValue(5000),
    };

    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const mockAppConfig = {
      backendApiUrl: vi.fn().mockReturnValue('http://localhost:3000/api'),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        CurrentMonthStore,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: TransactionApi, useValue: mockTransactionApi },
        { provide: BudgetCalculator, useValue: mockBudgetCalculator },
        { provide: Logger, useValue: mockLogger },
        { provide: ApplicationConfiguration, useValue: mockAppConfig },
      ],
    });

    store = TestBed.inject(CurrentMonthStore);
  });

  describe('User can see their financial situation', () => {
    it('should display available amount to spend correctly', async () => {
      // Business scenario: User opens the app and wants to see how much they can spend

      // Wait for resource to load (async operations in the store)
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Given: User has income, expenses, and rollover from previous month
      // When: User views their dashboard
      const availableToSpend = store.totalAvailable() - store.totalExpenses();

      // Then: The calculation should be: (Income + Rollover) - Expenses
      // Expected: (5000 + 500) - 1550 = 3950
      expect(availableToSpend).toBe(3950);
    });

    it('should show rollover from previous month', async () => {
      // Business scenario: User wants to see money carried over from last month

      // Wait for resource to load
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      const rollover = store.rolloverAmount();

      // Should show the positive rollover amount
      expect(rollover).toBe(500);
    });

    it('should calculate total spent excluding rollover for budget progress', async () => {
      // Business scenario: User wants to see how much they've spent this month
      // (excluding rollover from previous month for clear progress tracking)

      // Wait for resource to load
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      const totalSpent = store.totalExpenses();

      // Should exclude rollover: only current month expenses + transactions
      expect(totalSpent).toBe(1550); // 1500 (rent) + 50 (coffee) = 1550
    });

    it('should show total available including rollover', async () => {
      // Business scenario: User wants to see total money available this month

      // Wait for resource to load
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      const totalAvailable = store.totalAvailable();

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
        category: null,
      };

      // Should throw but not corrupt the store
      await expect(store.addTransaction(newTransaction)).rejects.toThrow(
        'Server unavailable',
      );

      // Wait for resource to load
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Store should still be functional after error
      expect(store.totalAvailable() - store.totalExpenses()).toBe(3950);
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

      // Wait for resource to load
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Store should still be functional
      expect(store.totalAvailable() - store.totalExpenses()).toBe(3950);
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

      // Wait for resource to load
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Store should still be functional
      expect(store.totalAvailable() - store.totalExpenses()).toBe(3950);
    });
  });

  describe('User can toggle budget line check', () => {
    let httpTesting: HttpTestingController;

    beforeEach(() => {
      httpTesting = TestBed.inject(HttpTestingController);
    });

    it('should update checkedAt locally before API completes (optimistic update)', async () => {
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      const budgetLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(budgetLine?.checkedAt).toBeNull();

      const togglePromise = store.toggleCheck('line-income');

      const updatedLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(updatedLine?.checkedAt).not.toBeNull();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/budget-lines/line-income/toggle-check',
      );
      req.flush({});

      await togglePromise;
    });

    it('should toggle checkedAt from non-null to null', async () => {
      const checkedBudgetLines: BudgetLine[] = [
        {
          ...mockBudgetLines[0],
          checkedAt: '2024-01-15T00:00:00Z',
        },
        mockBudgetLines[1],
      ];

      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(
        of({
          data: {
            budget: mockBudget,
            transactions: mockTransactions,
            budgetLines: checkedBudgetLines,
          },
        }),
      );
      store.refreshData();

      await vi.waitFor(() => {
        const line = store.budgetLines().find((l) => l.id === 'line-income');
        expect(line?.checkedAt).toBe('2024-01-15T00:00:00Z');
      });

      const togglePromise = store.toggleCheck('line-income');

      const updatedLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(updatedLine?.checkedAt).toBeNull();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/budget-lines/line-income/toggle-check',
      );
      req.flush({});

      await togglePromise;
    });

    it('should rollback on API error', async () => {
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      const originalCheckedAt = store
        .budgetLines()
        .find((l) => l.id === 'line-income')?.checkedAt;
      expect(originalCheckedAt).toBeNull();

      const togglePromise = store.toggleCheck('line-income');

      const updatedLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(updatedLine?.checkedAt).not.toBeNull();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/budget-lines/line-income/toggle-check',
      );
      req.error(new ProgressEvent('error'));

      await expect(togglePromise).rejects.toThrow();

      const restoredLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(restoredLine?.checkedAt).toBeNull();
    });

    it('should update realizedBalance when toggling income line', async () => {
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      const initialRealizedBalance = store.realizedBalance();

      const togglePromise = store.toggleCheck('line-income');

      const newRealizedBalance = store.realizedBalance();
      expect(newRealizedBalance).not.toBe(initialRealizedBalance);

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/budget-lines/line-income/toggle-check',
      );
      req.flush({});

      await togglePromise;
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

      const mockAppConfig = {
        backendApiUrl: vi.fn().mockReturnValue('http://localhost:3000/api'),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideHttpClient(),
          provideHttpClientTesting(),
          CurrentMonthStore,
          { provide: BudgetApi, useValue: mockBudgetApi },
          { provide: TransactionApi, useValue: mockTransactionApi },
          { provide: BudgetCalculator, useValue: mockBudgetCalculator },
          { provide: ApplicationConfiguration, useValue: mockAppConfig },
        ],
      });
      store = TestBed.inject(CurrentMonthStore);
    });

    it('should handle when user has no budget for the month', async () => {
      // Business scenario: User opens app for a month with no budget created

      // Wait for resource to load (will be empty)
      await vi.waitFor(() => {
        expect(store.isLoading()).toBe(false);
      });

      expect(store.budgetLines()).toEqual([]);
      expect(store.transactions()).toEqual([]);
      expect(store.totalAvailable()).toBe(0);
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
