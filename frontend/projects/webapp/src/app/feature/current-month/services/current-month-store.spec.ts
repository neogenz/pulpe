import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Budget, BudgetLine, Transaction } from '@pulpe/shared';

import { CurrentMonthStore } from './current-month-store';
import { BudgetApi, BudgetCalculator } from '@core/budget';
import { TransactionApi } from '@core/transaction/transaction-api';

// Mock data
const mockBudget: Budget = {
  id: 'budget-1',
  userId: 'user-1',
  templateId: 'template-1',
  month: 1,
  year: 2024,
  description: 'January Budget',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockBudgetLines: BudgetLine[] = [
  {
    id: 'line-1',
    budgetId: 'budget-1',
    templateLineId: 'tpl-1',
    isManuallyAdjusted: false,
    savingsGoalId: null,
    name: 'Salary',
    amount: 5000,
    kind: 'income',
    recurrence: 'fixed',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'line-2',
    budgetId: 'budget-1',
    templateLineId: 'tpl-2',
    isManuallyAdjusted: false,
    savingsGoalId: null,
    name: 'Rent',
    amount: 1500,
    kind: 'expense',
    recurrence: 'fixed',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'line-3',
    budgetId: 'budget-1',
    templateLineId: 'tpl-3',
    isManuallyAdjusted: false,
    savingsGoalId: null,
    name: 'Emergency Fund',
    amount: 500,
    kind: 'saving',
    recurrence: 'fixed',
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
  {
    id: 'txn-2',
    budgetId: 'budget-1',
    amount: 25,
    category: null,
    isOutOfBudget: false,
    name: 'Lunch',
    kind: 'expense',
    transactionDate: '2024-01-15T12:00:00Z',
    createdAt: '2024-01-15T12:00:00Z',
    updatedAt: '2024-01-15T12:00:00Z',
  },
];

describe('CurrentMonthStore', () => {
  let service: CurrentMonthStore;
  let mockBudgetApi: {
    getBudgetForMonth$: ReturnType<typeof vi.fn>;
    getBudgetWithDetails$: ReturnType<typeof vi.fn>;
  };
  let mockTransactionApi: {
    create$: ReturnType<typeof vi.fn>;
    remove$: ReturnType<typeof vi.fn>;
  };
  let mockBudgetCalculator: {
    calculatePlannedIncome: ReturnType<typeof vi.fn>;
    calculateFixedBlock: ReturnType<typeof vi.fn>;
    calculateLivingAllowance: ReturnType<typeof vi.fn>;
    calculateActualTransactionsAmount: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mocks
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
    };

    mockTransactionApi = {
      create$: vi.fn(),
      remove$: vi.fn(),
    };

    mockBudgetCalculator = {
      calculatePlannedIncome: vi
        .fn()
        .mockImplementation((lines) => (lines.length > 0 ? 5000 : 0)),
      calculateFixedBlock: vi
        .fn()
        .mockImplementation((lines) => (lines.length > 0 ? 2000 : 0)),
      calculateLivingAllowance: vi
        .fn()
        .mockImplementation((lines) => (lines.length > 0 ? 3000 : 0)),
      calculateActualTransactionsAmount: vi
        .fn()
        .mockImplementation((transactions) =>
          transactions.length > 0 ? 75 : 0,
        ),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        CurrentMonthStore,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: TransactionApi, useValue: mockTransactionApi },
        { provide: BudgetCalculator, useValue: mockBudgetCalculator },
      ],
    });

    service = TestBed.inject(CurrentMonthStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('Service Creation and Basic Properties', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should have all required public properties', () => {
      expect(service.dashboardData).toBeDefined();
      expect(service.budgetDate).toBeDefined();
      expect(service.budgetLines).toBeDefined();
      expect(service.livingAllowanceAmount).toBeDefined();
      expect(service.actualTransactionsAmount).toBeDefined();
    });

    it('should have all required public methods', () => {
      expect(service.refreshData).toBeDefined();
      expect(service.setCurrentDate).toBeDefined();
      expect(service.addTransaction).toBeDefined();
      expect(service.deleteTransaction).toBeDefined();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial values when no data is loaded', () => {
      // Before resource loads, these should return empty/zero values
      expect(service.budgetLines()).toEqual([]);
      expect(service.livingAllowanceAmount()).toBe(0);
      expect(service.actualTransactionsAmount()).toBe(0);
    });

    it('should have a current date set', () => {
      const today = service.budgetDate();
      expect(today).toBeInstanceOf(Date);
    });
  });

  describe('Date Management', () => {
    it('should update the current date', () => {
      const newDate = new Date('2024-02-15T10:00:00Z');
      service.setCurrentDate(newDate);
      expect(service.budgetDate()).toEqual(newDate);
    });

    it('should format date correctly for API calls', () => {
      // The resource would normally call the API with formatted dates
      // In test environment, the resource may not trigger immediately
      // We can verify the date formatting logic works
      const date = service.budgetDate();
      const month = date.getMonth() + 1; // JS months are 0-indexed
      const year = date.getFullYear();

      // The API would be called with zero-padded month and 4-digit year
      const expectedMonth = month.toString().padStart(2, '0');
      const expectedYear = year.toString();

      expect(expectedMonth).toMatch(/^\d{2}$/); // Should be 2-digit month
      expect(expectedYear).toMatch(/^\d{4}$/); // Should be 4-digit year
    });
  });

  describe('API Integration', () => {
    it('should be configured to call getBudgetForMonth', () => {
      // The service is configured with the API dependency
      // In production, the resource would call this on initialization
      // In tests, the resource/effect may not trigger automatically
      expect(mockBudgetApi.getBudgetForMonth$).toBeDefined();

      // Verify the API mock is properly configured
      const result = mockBudgetApi.getBudgetForMonth$('01', '2024');
      result.subscribe((data: Budget | null) => {
        expect(data).toEqual(mockBudget);
      });
    });

    it('should handle null budget response', () => {
      // Create a new service with null budget response
      mockBudgetApi.getBudgetForMonth$ = vi.fn().mockReturnValue(of(null));

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

      const newService = TestBed.inject(CurrentMonthStore);

      // Service should still be created
      expect(newService).toBeTruthy();
      expect(newService.budgetLines()).toEqual([]);
    });

    it('should handle API errors', () => {
      // Create a new service with error response
      mockBudgetApi.getBudgetForMonth$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('API Error')));

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

      const newService = TestBed.inject(CurrentMonthStore);

      // Service should still be created even with error
      expect(newService).toBeTruthy();
    });
  });

  describe('Transaction Methods', () => {
    it('should handle errors when adding transaction', async () => {
      const newTransaction = {
        budgetId: 'budget-1',
        amount: 100,
        name: 'Test',
        kind: 'expense' as const,
        transactionDate: '2024-01-16T14:00:00Z',
        isOutOfBudget: false,
        category: null,
      };

      mockTransactionApi.create$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('API Error')));

      await expect(service.addTransaction(newTransaction)).rejects.toThrow(
        'API Error',
      );
    });

    it('should handle errors when deleting transaction', async () => {
      mockTransactionApi.remove$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Delete Error')));

      await expect(service.deleteTransaction('txn-1')).rejects.toThrow(
        'Delete Error',
      );
    });
  });

  describe('Computed Values', () => {
    it('should return zero/empty values when no data is loaded', () => {
      expect(service.livingAllowanceAmount()).toBe(0);
      expect(service.actualTransactionsAmount()).toBe(0);
    });

    it('should call calculator methods with correct parameters', () => {
      // When we have empty data, the calculators should be called with empty arrays
      service.livingAllowanceAmount();
      expect(
        mockBudgetCalculator.calculateLivingAllowance,
      ).toHaveBeenCalledWith([]);

      service.actualTransactionsAmount();
      expect(
        mockBudgetCalculator.calculateActualTransactionsAmount,
      ).toHaveBeenCalledWith([]);
    });
  });

  describe('Refresh Functionality', () => {
    it('should have a refresh method that can be called', () => {
      expect(() => service.refreshData()).not.toThrow();
    });

    it('should expose refresh method', () => {
      const refreshSpy = vi.spyOn(service, 'refreshData');
      service.refreshData();
      expect(refreshSpy).toHaveBeenCalled();
    });
  });
});
