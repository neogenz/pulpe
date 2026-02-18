import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NEVER, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type {
  Budget,
  BudgetLine,
  Transaction,
  TransactionCreate,
} from 'pulpe-shared';

import { CurrentMonthStore } from './current-month-store';
import { BudgetApi } from '@core/budget';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { UserSettingsApi } from '@core/user-settings';

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
    checkedAt: null,
  },
];

const mockCache = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
  invalidate: vi.fn(),
  deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  clear: vi.fn(),
};

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
    toggleBudgetLineCheck$: Mock;
    createTransaction$: Mock;
    updateTransaction$: Mock;
    deleteTransaction$: Mock;
    toggleTransactionCheck$: Mock;
    cache: typeof mockCache;
  };
  let mockInvalidationService: {
    version: ReturnType<typeof signal<number>>;
    invalidate: Mock;
  };

  beforeEach(() => {
    // Realistic mocks that simulate actual business behaviors
    mockCache.get.mockReturnValue(null);

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
      toggleBudgetLineCheck$: vi.fn().mockReturnValue(of(undefined)),
      createTransaction$: vi.fn(),
      updateTransaction$: vi.fn(),
      deleteTransaction$: vi.fn(),
      toggleTransactionCheck$: vi.fn(),
      cache: mockCache,
    };

    const mockUserSettingsApi = {
      payDayOfMonth: signal<number | null>(null),
      isLoading: signal(false),
    };

    mockInvalidationService = { version: signal(0), invalidate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        CurrentMonthStore,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: UserSettingsApi, useValue: mockUserSettingsApi },
        {
          provide: BudgetInvalidationService,
          useValue: mockInvalidationService,
        },
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
    it('should allow user to refresh their financial data', async () => {
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      expect(() => store.refreshData()).not.toThrow();
    });
  });

  describe('SWR loading behavior', () => {
    it('should expose reloading status when stale cache exists during fetch', async () => {
      const staleDashboardData = {
        budget: mockBudget,
        transactions: mockTransactions,
        budgetLines: mockBudgetLines,
      };

      const staleCache = {
        ...mockCache,
        get: vi.fn((key: string[]) => {
          if (key[0] === 'budget' && key[1] === 'dashboard') {
            return { data: staleDashboardData, fresh: false };
          }
          return null;
        }),
      };

      const slowBudgetApi = {
        ...mockBudgetApi,
        getBudgetForMonth$: vi.fn().mockReturnValue(NEVER),
        cache: staleCache,
      };

      const mockUserSettingsApi = {
        payDayOfMonth: signal<number | null>(null),
        isLoading: signal(false),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideHttpClient(),
          provideHttpClientTesting(),
          CurrentMonthStore,
          { provide: BudgetApi, useValue: slowBudgetApi },
          { provide: UserSettingsApi, useValue: mockUserSettingsApi },
          {
            provide: BudgetInvalidationService,
            useValue: { version: signal(0), invalidate: vi.fn() },
          },
        ],
      });

      const swrStore = TestBed.inject(CurrentMonthStore);

      await vi.waitFor(() => {
        expect(swrStore.status()).toBe('reloading');
      });
      expect(swrStore.isInitialLoading()).toBe(false);
      expect(swrStore.dashboardData()).toEqual(staleDashboardData);
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

      mockBudgetApi.createTransaction$.mockReturnValue(
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
      mockBudgetApi.updateTransaction$.mockReturnValue(
        of({ data: { id: 'trans-1', amount: 200, name: 'Updated' } }),
      );

      // Should complete without throwing
      await expect(
        store.updateTransaction('trans-1', { amount: 200 }),
      ).resolves.toBeUndefined();
    });

    it('should allow deleting a transaction without errors', async () => {
      // Business scenario: User removes an unwanted transaction
      mockBudgetApi.deleteTransaction$.mockReturnValue(of(undefined));

      // Should complete without throwing
      await expect(store.deleteTransaction('trans-1')).resolves.toBeUndefined();
    });
  });

  describe('App handles errors gracefully', () => {
    it('should maintain stability when add transaction fails', async () => {
      // Business scenario: App doesn't crash when server is down during transaction creation
      mockBudgetApi.createTransaction$.mockReturnValue(
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
      mockBudgetApi.updateTransaction$.mockReturnValue(
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
      mockBudgetApi.deleteTransaction$.mockReturnValue(
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
    it('should update checkedAt locally before API completes (optimistic update)', async () => {
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      const budgetLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(budgetLine?.checkedAt).toBeNull();

      const togglePromise = store.toggleBudgetLineCheck('line-income');

      // Optimistic update: checkedAt should be set immediately
      const updatedLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(updatedLine?.checkedAt).not.toBeNull();

      await togglePromise;
      expect(mockBudgetApi.toggleBudgetLineCheck$).toHaveBeenCalledWith(
        'line-income',
      );
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

      await store.toggleBudgetLineCheck('line-income');

      const updatedLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(updatedLine?.checkedAt).toBeNull();
      expect(mockBudgetApi.toggleBudgetLineCheck$).toHaveBeenCalledWith(
        'line-income',
      );
    });

    it('should rollback on API error', async () => {
      mockBudgetApi.toggleBudgetLineCheck$.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      const originalCheckedAt = store
        .budgetLines()
        .find((l) => l.id === 'line-income')?.checkedAt;
      expect(originalCheckedAt).toBeNull();

      const togglePromise = store.toggleBudgetLineCheck('line-income');

      // Verify optimistic update happened
      const updatedLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(updatedLine?.checkedAt).not.toBeNull();

      await expect(togglePromise).rejects.toThrow();

      const restoredLine = store
        .budgetLines()
        .find((l) => l.id === 'line-income');
      expect(restoredLine?.checkedAt).toBeNull();
    });
  });

  describe('Mutations delegate to BudgetApi', () => {
    beforeEach(async () => {
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });
    });

    it('should delegate to BudgetApi.createTransaction$ when adding a transaction', async () => {
      mockBudgetApi.createTransaction$.mockReturnValue(
        of({
          data: {
            id: 'new-tx',
            budgetId: 'budget-1',
            name: 'Test',
            amount: 10,
            kind: 'expense',
            transactionDate: '2024-01-25T00:00:00Z',
            category: null,
            createdAt: '2024-01-25T00:00:00Z',
            updatedAt: '2024-01-25T00:00:00Z',
            checkedAt: null,
            budgetLineId: null,
          },
        }),
      );

      await store.addTransaction({
        budgetId: 'budget-1',
        name: 'Test',
        amount: 10,
        kind: 'expense',
        transactionDate: '2024-01-25T00:00:00Z',
        category: null,
      });

      expect(mockBudgetApi.createTransaction$).toHaveBeenCalled();
    });

    it('should delegate to BudgetApi.deleteTransaction$ when deleting a transaction', async () => {
      mockBudgetApi.deleteTransaction$.mockReturnValue(of(undefined));

      await store.deleteTransaction('txn-1');

      expect(mockBudgetApi.deleteTransaction$).toHaveBeenCalledWith('txn-1');
    });

    it('should delegate to BudgetApi.updateTransaction$ when updating a transaction', async () => {
      mockBudgetApi.updateTransaction$.mockReturnValue(
        of({ data: { id: 'txn-1', amount: 200, name: 'Updated' } }),
      );

      await store.updateTransaction('txn-1', { amount: 200 });

      expect(mockBudgetApi.updateTransaction$).toHaveBeenCalledWith('txn-1', {
        amount: 200,
      });
    });

    it('should delegate to BudgetApi.toggleBudgetLineCheck$ when toggling budget line check', async () => {
      await store.toggleBudgetLineCheck('line-income');

      expect(mockBudgetApi.toggleBudgetLineCheck$).toHaveBeenCalledWith(
        'line-income',
      );
    });

    it('should delegate to BudgetApi.toggleTransactionCheck$ when toggling transaction check', async () => {
      mockBudgetApi.toggleTransactionCheck$.mockReturnValue(of(undefined));

      await store.toggleTransactionCheck('txn-1');

      expect(mockBudgetApi.toggleTransactionCheck$).toHaveBeenCalledWith(
        'txn-1',
      );
    });
  });

  describe('App handles empty states gracefully', () => {
    beforeEach(() => {
      // Setup scenario with no data
      mockBudgetApi.getBudgetForMonth$.mockReturnValue(of(null));
      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(
        of({ data: { budget: null, transactions: [], budgetLines: [] } }),
      );

      const mockUserSettingsApi = {
        payDayOfMonth: signal<number | null>(null),
        isLoading: signal(false),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideHttpClient(),
          provideHttpClientTesting(),
          CurrentMonthStore,
          { provide: BudgetApi, useValue: mockBudgetApi },
          { provide: UserSettingsApi, useValue: mockUserSettingsApi },
          {
            provide: BudgetInvalidationService,
            useValue: { version: signal(0), invalidate: vi.fn() },
          },
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

/**
 * Pay-Day Integration Tests
 *
 * Tests that verify the behavior when a custom pay day is configured.
 * Key business rule (QUINZAINE): Budget is named after the month with MAJORITY of days.
 *
 * - payDay <= 15 (1ère quinzaine): Budget starts on payDay of SAME month
 *   → Budget "Mars" covers: 5 mars - 4 avril (majority in March)
 * - payDay > 15 (2ème quinzaine): Budget starts on payDay of PREVIOUS month
 *   → Budget "Mars" covers: 27 fév - 26 mars (majority in March)
 *
 * Examples with payDay=27:
 * - Jan 28 → February budget (27 jan - 26 fév)
 * - Jan 26 → January budget (27 déc - 26 jan)
 * - Dec 27 → January next year (27 déc - 26 jan)
 */
describe('CurrentMonthStore - Pay Day Integration', () => {
  let store: CurrentMonthStore;
  let payDaySignal: ReturnType<typeof signal<number | null>>;
  let mockBudgetApi: {
    getBudgetForMonth$: Mock;
    getBudgetWithDetails$: Mock;
    getBudgetById$: Mock;
    toggleBudgetLineCheck$: Mock;
    cache: typeof mockCache;
  };

  const mockJanuaryBudget: Budget = {
    id: 'budget-jan',
    userId: 'user-1',
    templateId: 'template-1',
    month: 1,
    year: 2024,
    description: 'January Budget',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    endingBalance: 0,
    rollover: 500,
  };

  beforeEach(() => {
    payDaySignal = signal<number | null>(null);

    mockCache.get.mockReturnValue(null);

    mockBudgetApi = {
      getBudgetForMonth$: vi.fn().mockReturnValue(of(mockJanuaryBudget)),
      getBudgetWithDetails$: vi.fn().mockReturnValue(
        of({
          data: {
            budget: mockJanuaryBudget,
            transactions: [],
            budgetLines: [],
          },
        }),
      ),
      getBudgetById$: vi.fn().mockReturnValue(of(mockJanuaryBudget)),
      toggleBudgetLineCheck$: vi.fn().mockReturnValue(of(undefined)),
      cache: mockCache,
    };

    const mockUserSettingsApi = {
      payDayOfMonth: payDaySignal.asReadonly(),
      isLoading: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        CurrentMonthStore,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: UserSettingsApi, useValue: mockUserSettingsApi },
        {
          provide: BudgetInvalidationService,
          useValue: { version: signal(0), invalidate: vi.fn() },
        },
      ],
    });

    store = TestBed.inject(CurrentMonthStore);
  });

  describe('Budget period calculation with custom pay day', () => {
    it('should compute February period when today is Jan 28 and payDay is 27', () => {
      // Business scenario: User is paid on the 27th (2ème quinzaine).
      // On January 28, they're in the February budget period (27 jan - 26 fév).
      payDaySignal.set(27);
      store.setCurrentDate(new Date('2024-01-28'));

      const period = store.currentBudgetPeriod();

      // 28 >= 27, payDay > 15 → +1 month → February
      expect(period).toEqual({ month: 2, year: 2024 });
    });

    it('should compute January period when today is Jan 26 and payDay is 27', () => {
      // Business scenario: User is paid on the 27th (2ème quinzaine).
      // On January 26, they're in the January budget period (27 déc - 26 jan).
      payDaySignal.set(27);
      store.setCurrentDate(new Date('2024-01-26'));

      const period = store.currentBudgetPeriod();

      // 26 < 27 → December, then payDay > 15 → +1 month → January
      expect(period).toEqual({ month: 1, year: 2024 });
    });

    it('should compute January 2025 period when today is Dec 27 and payDay is 27', () => {
      // Business scenario: Year boundary.
      // On December 27, user starts the January 2025 budget period (27 déc - 26 jan).
      payDaySignal.set(27);
      store.setCurrentDate(new Date('2024-12-27'));

      const period = store.currentBudgetPeriod();

      // 27 >= 27 → December, then payDay > 15 → +1 month → January 2025
      expect(period).toEqual({ month: 1, year: 2025 });
    });

    it('should use calendar month when payDay is null', () => {
      // Business scenario: User has no custom pay day configured.
      // Standard calendar behavior: January 28 = January budget.
      payDaySignal.set(null);
      store.setCurrentDate(new Date('2024-01-28'));

      const period = store.currentBudgetPeriod();

      expect(period).toEqual({ month: 1, year: 2024 });
    });

    it('should use calendar month when payDay is 1', () => {
      // Business scenario: User is paid on the 1st (standard calendar).
      payDaySignal.set(1);
      store.setCurrentDate(new Date('2024-01-28'));

      const period = store.currentBudgetPeriod();

      expect(period).toEqual({ month: 1, year: 2024 });
    });

    it('should compute January when today is Jan 6 and payDay is 3', () => {
      // Business scenario: User is paid on the 3rd.
      // On January 6, they already received their January paycheck on the 3rd.
      payDaySignal.set(3);
      store.setCurrentDate(new Date('2024-01-06'));

      const period = store.currentBudgetPeriod();

      // 6 >= 3 → current month (January)
      expect(period).toEqual({ month: 1, year: 2024 });
    });
  });

  describe('Dashboard loads correct budget based on pay day', () => {
    it('should request February budget when today is Jan 28 and payDay is 27', async () => {
      // Business scenario: Dashboard should load the budget for the computed period
      // With quinzaine logic, Jan 28 + payDay=27 → February budget
      payDaySignal.set(27);
      store.setCurrentDate(new Date('2024-01-28'));

      // Wait for resource to trigger
      await vi.waitFor(() => {
        expect(mockBudgetApi.getBudgetForMonth$).toHaveBeenCalled();
      });

      // Verify the API was called with February (month=2)
      expect(mockBudgetApi.getBudgetForMonth$).toHaveBeenCalledWith(
        '02',
        '2024',
      );
    });
  });
});

/**
 * Envelope Allocation Integration Tests
 *
 * These tests verify the business rule for allocated transactions:
 * - Transactions allocated to an envelope (budgetLineId != null) should NOT
 *   impact the remaining budget, UNLESS they exceed the envelope amount.
 * - Only the OVERAGE (consumed - envelope.amount) should impact remaining.
 * - Free transactions (budgetLineId = null) should impact remaining normally.
 *
 * IMPORTANT: These tests do NOT mock BudgetFormulas - they test the real
 * calculation logic in CurrentMonthStore.
 */
describe('CurrentMonthStore - Envelope Allocation Logic', () => {
  let store: CurrentMonthStore;
  let mockBudgetApi: {
    getBudgetForMonth$: Mock;
    getBudgetWithDetails$: Mock;
    getBudgetById$: Mock;
    toggleBudgetLineCheck$: Mock;
    cache: typeof mockCache;
  };

  // Helper to create budget lines
  const createBudgetLine = (
    id: string,
    name: string,
    amount: number,
    kind: 'income' | 'expense' | 'saving',
  ): BudgetLine => ({
    id,
    budgetId: 'budget-1',
    templateLineId: `tpl-${id}`,
    isManuallyAdjusted: false,
    savingsGoalId: null,
    name,
    amount,
    kind,
    recurrence: 'fixed',
    checkedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  });

  // Helper to create transactions
  const createTransaction = (
    id: string,
    name: string,
    amount: number,
    kind: 'income' | 'expense' | 'saving',
    budgetLineId: string | null = null,
  ): Transaction => ({
    id,
    budgetId: 'budget-1',
    budgetLineId,
    amount,
    category: null,
    name,
    kind,
    transactionDate: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    checkedAt: null,
  });

  const setupStore = (
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ) => {
    const budget: Budget = {
      id: 'budget-1',
      userId: 'user-1',
      templateId: 'template-1',
      month: 1,
      year: 2024,
      description: 'January Budget',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      endingBalance: 0,
      rollover: 0,
    };

    mockCache.get.mockReturnValue(null);

    mockBudgetApi = {
      getBudgetForMonth$: vi.fn().mockReturnValue(of(budget)),
      getBudgetWithDetails$: vi.fn().mockReturnValue(
        of({
          data: {
            budget,
            transactions,
            budgetLines,
          },
        }),
      ),
      getBudgetById$: vi.fn().mockReturnValue(of(budget)),
      toggleBudgetLineCheck$: vi.fn().mockReturnValue(of(undefined)),
      cache: mockCache,
    };

    const mockUserSettingsApi = {
      payDayOfMonth: signal<number | null>(null),
      isLoading: signal(false),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        CurrentMonthStore,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: UserSettingsApi, useValue: mockUserSettingsApi },
        {
          provide: BudgetInvalidationService,
          useValue: { version: signal(0), invalidate: vi.fn() },
        },
      ],
    });

    return TestBed.inject(CurrentMonthStore);
  };

  describe('Allocated transactions within envelope limits', () => {
    it('should NOT impact remaining when allocated transaction is within envelope budget', async () => {
      // Arrange: Income 5000, Envelope expense 500, Allocated transaction 100
      // Business rule: The 100 CHF transaction is "covered" by the envelope,
      // so remaining should be: 5000 - 500 = 4500 (NOT 5000 - 500 - 100 = 4400)
      const budgetLines = [
        createBudgetLine('income-1', 'Salary', 5000, 'income'),
        createBudgetLine('envelope-1', 'Groceries', 500, 'expense'),
      ];
      const transactions = [
        createTransaction('tx-1', 'Supermarket', 100, 'expense', 'envelope-1'),
      ];

      store = setupStore(budgetLines, transactions);

      // Act: Wait for data to load
      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Assert: Remaining should NOT include the allocated transaction
      // Expected: 5000 (income) - 500 (envelope) = 4500
      // Bug behavior: 5000 - 500 - 100 = 4400 (incorrectly counts allocated tx)
      expect(store.remaining()).toBe(4500);
    });

    it('should NOT impact remaining when multiple allocated transactions stay within envelope', async () => {
      // Arrange: Envelope 500, three transactions totaling 400 (within limit)
      const budgetLines = [
        createBudgetLine('income-1', 'Salary', 5000, 'income'),
        createBudgetLine('envelope-1', 'Groceries', 500, 'expense'),
      ];
      const transactions = [
        createTransaction('tx-1', 'Shop A', 150, 'expense', 'envelope-1'),
        createTransaction('tx-2', 'Shop B', 150, 'expense', 'envelope-1'),
        createTransaction('tx-3', 'Shop C', 100, 'expense', 'envelope-1'),
      ];

      store = setupStore(budgetLines, transactions);

      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Assert: 400 CHF consumed within 500 CHF envelope = no additional impact
      // Expected: 5000 - 500 = 4500
      expect(store.remaining()).toBe(4500);
    });
  });

  describe('Allocated transactions exceeding envelope limits', () => {
    it('should impact remaining ONLY by the overage amount', async () => {
      // Arrange: Envelope 100, Transaction 150 = 50 CHF overage
      const budgetLines = [
        createBudgetLine('income-1', 'Salary', 5000, 'income'),
        createBudgetLine('envelope-1', 'Groceries', 100, 'expense'),
      ];
      const transactions = [
        createTransaction(
          'tx-1',
          'Expensive groceries',
          150,
          'expense',
          'envelope-1',
        ),
      ];

      store = setupStore(budgetLines, transactions);

      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Assert: Only 50 CHF overage should impact remaining
      // Expected: 5000 - 100 (envelope) - 50 (overage) = 4850
      // Or with effective amount: 5000 - 150 (max of envelope and consumed) = 4850
      expect(store.remaining()).toBe(4850);
    });

    it('should correctly calculate 88 CHF overage (real user scenario)', async () => {
      // Arrange: Exact scenario from user bug report
      // Envelope 100 CHF, Transaction 188 CHF = 88 CHF overage
      const budgetLines = [
        createBudgetLine('income-1', 'Salary', 1000, 'income'),
        createBudgetLine('envelope-1', 'Test Envelope', 100, 'expense'),
      ];
      const transactions = [
        createTransaction(
          'tx-1',
          'test_feature_dev_1',
          188,
          'expense',
          'envelope-1',
        ),
      ];

      store = setupStore(budgetLines, transactions);

      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Assert: Remaining = 1000 - 100 - 88 = 812 (or 1000 - 188 = 812)
      // Bug behavior: 1000 - 100 - 188 = 712 (double counting)
      expect(store.remaining()).toBe(812);
    });
  });

  describe('Mixed free and allocated transactions', () => {
    it('should count free transactions normally while ignoring allocated within envelope', async () => {
      // Arrange: Mix of free and allocated transactions
      const budgetLines = [
        createBudgetLine('income-1', 'Salary', 5000, 'income'),
        createBudgetLine('envelope-1', 'Groceries', 500, 'expense'),
      ];
      const transactions = [
        // Allocated within envelope - should NOT impact remaining
        createTransaction('tx-1', 'Supermarket', 200, 'expense', 'envelope-1'),
        // Free transaction - SHOULD impact remaining
        createTransaction('tx-2', 'Restaurant', 50, 'expense', null),
      ];

      store = setupStore(budgetLines, transactions);

      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Assert: Only the free transaction (50 CHF) should reduce remaining
      // Expected: 5000 - 500 - 50 = 4450
      // Bug behavior: 5000 - 500 - 200 - 50 = 4250
      expect(store.remaining()).toBe(4450);
    });

    it('should count free income transactions as positive impact', async () => {
      // Arrange: Free income transaction
      const budgetLines = [
        createBudgetLine('income-1', 'Salary', 5000, 'income'),
        createBudgetLine('envelope-1', 'Groceries', 500, 'expense'),
      ];
      const transactions = [
        createTransaction('tx-1', 'Freelance bonus', 100, 'income', null),
      ];

      store = setupStore(budgetLines, transactions);

      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Assert: Free income increases remaining
      // Expected: 5000 - 500 + 100 = 4600
      expect(store.remaining()).toBe(4600);
    });
  });

  describe('Multiple envelopes with different states', () => {
    it('should handle multiple envelopes: one within limit, one with overage', async () => {
      // Arrange: Two envelopes with different consumption states
      const budgetLines = [
        createBudgetLine('income-1', 'Salary', 5000, 'income'),
        createBudgetLine('envelope-1', 'Groceries', 500, 'expense'), // Will stay within
        createBudgetLine('envelope-2', 'Restaurant', 200, 'expense'), // Will exceed
      ];
      const transactions = [
        // Envelope 1: 300/500 = within limit, no impact
        createTransaction('tx-1', 'Supermarket', 300, 'expense', 'envelope-1'),
        // Envelope 2: 350/200 = 150 overage
        createTransaction('tx-2', 'Fancy dinner', 200, 'expense', 'envelope-2'),
        createTransaction(
          'tx-3',
          'Another dinner',
          150,
          'expense',
          'envelope-2',
        ),
      ];

      store = setupStore(budgetLines, transactions);

      await vi.waitFor(() => {
        expect(store.dashboardData()).toBeTruthy();
      });

      // Assert: Only the 150 CHF overage from envelope-2 should impact
      // Expected: 5000 - 500 - 200 - 150 = 4150
      // Or: 5000 - 500 - 350 (max of 200 and 350) = 4150
      expect(store.remaining()).toBe(4150);
    });
  });
});
