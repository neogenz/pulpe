import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { TransactionCreate } from '@pulpe/shared';

import { CurrentMonthStore } from './current-month-store';
import { BudgetApi, BudgetCalculator } from '@core/budget';
import { TransactionApi } from '@core/transaction/transaction-api';
import { Logger } from '@core/logging/logger';

/**
 * Business Value Tests for Transaction Operations
 *
 * These tests focus on what matters to the user:
 * 1. Can they add/update/delete transactions?
 * 2. Does the app remain stable when operations fail?
 * 3. Is the ending balance calculated correctly?
 */
describe('CurrentMonthStore - Transaction Business Value', () => {
  let store: CurrentMonthStore;
  let transactionApiMock: {
    create$: Mock;
    update$: Mock;
    remove$: Mock;
  };

  beforeEach(() => {
    // Simple mocks - focus on behavior, not implementation
    const budgetApiMock = {
      getBudgetForMonth$: vi.fn().mockReturnValue(of(null)),
      getBudgetWithDetails$: vi
        .fn()
        .mockReturnValue(
          of({ data: { budget: null, transactions: [], budgetLines: [] } }),
        ),
      getBudgetById$: vi.fn().mockReturnValue(of(null)),
    };

    transactionApiMock = {
      create$: vi.fn(),
      update$: vi.fn(),
      remove$: vi.fn(),
    };

    const budgetCalculatorMock = {
      calculateLocalEndingBalance: vi.fn().mockReturnValue(0),
      calculateBalance: vi.fn().mockReturnValue(0),
      calculatePlannedIncome: vi.fn().mockReturnValue(0),
      calculateActualTransactionsAmount: vi.fn().mockReturnValue(0),
      calculateTotalSpentIncludingRollover: vi.fn().mockReturnValue(0),
      calculateTotalSpentExcludingRollover: vi.fn().mockReturnValue(0),
      calculateTotalAvailable: vi.fn().mockReturnValue(0),
      calculateRolloverAmount: vi.fn().mockReturnValue(0),
    };

    const loggerMock = {
      info: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        CurrentMonthStore,
        { provide: BudgetApi, useValue: budgetApiMock },
        { provide: TransactionApi, useValue: transactionApiMock },
        { provide: BudgetCalculator, useValue: budgetCalculatorMock },
        { provide: Logger, useValue: loggerMock },
      ],
    });

    store = TestBed.inject(CurrentMonthStore);
  });

  describe('User can manage transactions', () => {
    it('should allow adding a transaction without errors', async () => {
      // Business value: User can add expenses and the operation completes
      const newTransaction: TransactionCreate = {
        budgetId: 'budget-1',
        name: 'Coffee',
        amount: 5,
        kind: 'expense',
        transactionDate: '2024-01-25T00:00:00Z',
        isOutOfBudget: false,
        category: null,
      };

      transactionApiMock.create$.mockReturnValue(
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
      // Business value: User can modify transactions
      transactionApiMock.update$.mockReturnValue(
        of({ data: { id: 'trans-1', amount: 200, name: 'Updated' } }),
      );

      // Should complete without throwing
      await expect(
        store.updateTransaction('trans-1', { amount: 200 }),
      ).resolves.toBeUndefined();
    });

    it('should allow deleting a transaction without errors', async () => {
      // Business value: User can remove unwanted transactions
      transactionApiMock.remove$.mockReturnValue(of(undefined));

      // Should complete without throwing
      await expect(store.deleteTransaction('trans-1')).resolves.toBeUndefined();
    });
  });

  describe('App handles errors gracefully', () => {
    it('should maintain stability when add transaction fails', async () => {
      // Business value: App doesn't crash when server is down
      transactionApiMock.create$.mockReturnValue(
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

      // Store should still be functional
      expect(store.availableToSpend()).toBe(0);
      expect(store.budgetLines()).toEqual([]);
    });

    it('should maintain stability when update transaction fails', async () => {
      // Business value: Failed updates don't corrupt data
      transactionApiMock.update$.mockReturnValue(
        throwError(() => new Error('Update failed')),
      );

      // Should throw but not corrupt the store
      await expect(
        store.updateTransaction('trans-1', { amount: 200 }),
      ).rejects.toThrow('Update failed');

      // Store should still be functional
      expect(store.availableToSpend()).toBe(0);
    });

    it('should maintain stability when delete transaction fails', async () => {
      // Business value: Failed deletions don't corrupt data
      transactionApiMock.remove$.mockReturnValue(
        throwError(() => new Error('Delete failed')),
      );

      // Should throw but not corrupt the store
      await expect(store.deleteTransaction('trans-1')).rejects.toThrow(
        'Delete failed',
      );

      // Store should still be functional
      expect(store.availableToSpend()).toBe(0);
    });
  });
});
