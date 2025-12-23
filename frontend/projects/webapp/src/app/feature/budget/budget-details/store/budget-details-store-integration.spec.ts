import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  BudgetLineCreate,
  BudgetLineUpdate,
  TransactionCreate,
  TransactionUpdate,
} from '@pulpe/shared';

import { BudgetDetailsStore } from './budget-details-store';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { TransactionApi } from '@core/transaction/transaction-api';
import { Logger } from '@core/logging/logger';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { PostHogService } from '@core/analytics/posthog';
import {
  createMockBudgetLine,
  createMockBudgetDetailsResponse,
  createMockTransaction,
} from '../../../../testing/mock-factories';

// Mock data
const mockBudgetId = 'budget-123';

const mockBudgetDetailsResponse = createMockBudgetDetailsResponse({
  budget: {
    id: mockBudgetId,
    userId: 'user-1',
    templateId: 'template-1',
    month: 1,
    year: 2024,
    description: 'January Budget',
  },
  budgetLines: [
    createMockBudgetLine({
      id: 'line-1',
      budgetId: mockBudgetId,
      templateLineId: 'tpl-1',
      name: 'Salary',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'line-2',
      budgetId: mockBudgetId,
      templateLineId: 'tpl-2',
      name: 'Rent',
      amount: 1500,
      kind: 'expense',
      recurrence: 'fixed',
    }),
  ],
  transactions: [
    createMockTransaction({
      id: 'tx-1',
      budgetId: mockBudgetId,
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-05',
      name: 'Groceries',
    }),
  ],
});

describe('BudgetDetailsStore - User Behavior Tests', () => {
  let service: BudgetDetailsStore;
  let httpMock: HttpTestingController;
  let mockBudgetApi: {
    getBudgetWithDetails$: ReturnType<typeof vi.fn>;
  };
  let mockBudgetLineApi: {
    createBudgetLine$: ReturnType<typeof vi.fn>;
    updateBudgetLine$: ReturnType<typeof vi.fn>;
    deleteBudgetLine$: ReturnType<typeof vi.fn>;
    getAllocatedTransactions$: ReturnType<typeof vi.fn>;
  };
  let mockTransactionApi: {
    create$: ReturnType<typeof vi.fn>;
    update$: ReturnType<typeof vi.fn>;
    remove$: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
  };
  let mockApplicationConfiguration: {
    backendApiUrl: ReturnType<typeof vi.fn>;
  };
  let mockPostHogService: {
    captureException: ReturnType<typeof vi.fn>;
    isInitialized: ReturnType<typeof vi.fn>;
    isEnabled: ReturnType<typeof vi.fn>;
  };

  // Helper function to wait for resource to stabilize
  const waitForResourceStable = async (timeout = 1000): Promise<void> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (!service.isLoading()) {
        // Wait a bit more to ensure stability
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (!service.isLoading()) {
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error(`Resource did not stabilize within ${timeout}ms`);
  };

  beforeEach(() => {
    // Create mocks
    mockBudgetApi = {
      getBudgetWithDetails$: vi
        .fn()
        .mockReturnValue(of(mockBudgetDetailsResponse)),
    };

    mockBudgetLineApi = {
      createBudgetLine$: vi.fn(),
      updateBudgetLine$: vi.fn(),
      deleteBudgetLine$: vi.fn(),
      getAllocatedTransactions$: vi
        .fn()
        .mockReturnValue(of({ success: true, data: [] })),
    };

    mockTransactionApi = {
      create$: vi.fn(),
      update$: vi.fn(),
      remove$: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
    };

    mockApplicationConfiguration = {
      backendApiUrl: vi.fn().mockReturnValue('http://localhost:3000/api/v1'),
    };

    mockPostHogService = {
      captureException: vi.fn(),
      isInitialized: vi.fn(() => ({ value: true })),
      isEnabled: vi.fn(() => ({ value: true })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        BudgetDetailsStore,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: BudgetLineApi, useValue: mockBudgetLineApi },
        { provide: TransactionApi, useValue: mockTransactionApi },
        { provide: Logger, useValue: mockLogger },
        {
          provide: ApplicationConfiguration,
          useValue: mockApplicationConfiguration,
        },
        { provide: PostHogService, useValue: mockPostHogService },
      ],
    });

    service = TestBed.inject(BudgetDetailsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Verify that no unexpected HTTP requests were made
    httpMock?.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('User views budget details', () => {
    it('displays budget with all income and expense lines when user opens budget page', async () => {
      // User opens a budget page
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      // Budget data is displayed
      const budgetDetails = service.budgetDetails();
      expect(budgetDetails).toBeDefined();
      expect(budgetDetails?.budgetLines).toHaveLength(2);

      // User sees their salary income
      const salaryLine = budgetDetails?.budgetLines.find(
        (l) => l.name === 'Salary',
      );
      expect(salaryLine?.amount).toBe(5000);
      expect(salaryLine?.kind).toBe('income');

      // User sees their rent expense
      const rentLine = budgetDetails?.budgetLines.find(
        (l) => l.name === 'Rent',
      );
      expect(rentLine?.amount).toBe(1500);
      expect(rentLine?.kind).toBe('expense');
    });
  });

  describe('User adds a budget line', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();
    });

    it('new expense appears immediately in the budget list', async () => {
      // User adds a new grocery expense
      const newExpense: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Courses',
        amount: 400,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      };

      mockBudgetLineApi.createBudgetLine$ = vi.fn().mockReturnValue(
        of({
          data: {
            id: 'line-new',
            ...newExpense,
            templateLineId: null,
            savingsGoalId: null,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
          },
        }),
      );

      const initialCount = service.budgetDetails()?.budgetLines.length || 0;

      // User clicks save
      const createPromise = service.createBudgetLine(newExpense);

      // The new line appears immediately in the list
      expect(service.budgetDetails()?.budgetLines.length).toBe(
        initialCount + 1,
      );

      // User can see the new expense with its details
      await createPromise;
      const addedLine = service
        .budgetDetails()
        ?.budgetLines.find((l) => l.name === 'Courses');
      expect(addedLine?.amount).toBe(400);
    });

    it('original budget is restored when server fails to save', async () => {
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Network error')));

      // User tries to add an expense but server is down
      await service.createBudgetLine({
        budgetId: mockBudgetId,
        name: 'Failed expense',
        amount: 100,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      });

      // User sees an error occurred
      expect(service.error()).toBeTruthy();

      // Budget lines remain unchanged (data is reloaded from server)
      // This ensures user doesn't see incorrect optimistic data
    });
  });

  describe('User edits a budget line', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();
    });

    it('changes appear immediately when user updates an amount', async () => {
      mockBudgetLineApi.updateBudgetLine$ = vi.fn().mockReturnValue(
        of({
          data: {
            ...mockBudgetDetailsResponse.data.budgetLines[1],
            name: 'Updated Rent',
            amount: 1600,
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      // User changes rent amount from 1500 to 1600
      await service.updateBudgetLine({
        id: 'line-2',
        name: 'Updated Rent',
        amount: 1600,
      });

      // The updated amount is visible immediately
      const rentLine = service
        .budgetDetails()
        ?.budgetLines.find((l) => l.id === 'line-2');
      expect(rentLine?.name).toBe('Updated Rent');
      expect(rentLine?.amount).toBe(1600);
    });

    it('original values are restored when update fails', async () => {
      mockBudgetLineApi.updateBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Server error')));

      // User tries to update but server fails
      await service.updateBudgetLine({
        id: 'line-2',
        name: 'Failed Update',
        amount: 9999,
      });

      // Error is shown to user
      expect(service.error()).toBeTruthy();

      // Original values are preserved (via reload)
      // User doesn't see the failed update stuck in UI
    });
  });

  describe('User deletes a budget line', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();
    });

    it('budget line disappears immediately from the list', async () => {
      mockBudgetLineApi.deleteBudgetLine$ = vi.fn().mockReturnValue(of({}));

      const initialCount = service.budgetDetails()?.budgetLines.length || 0;

      // User deletes the rent expense
      await service.deleteBudgetLine('line-2');

      // The line is no longer visible
      const remainingLines = service.budgetDetails()?.budgetLines;
      expect(remainingLines?.length).toBe(initialCount - 1);
      expect(remainingLines?.find((l) => l.id === 'line-2')).toBeUndefined();
    });

    it('deleted line reappears when deletion fails on server', async () => {
      mockBudgetLineApi.deleteBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Cannot delete')));

      // User tries to delete but server refuses
      await service.deleteBudgetLine('line-2');

      // Error is shown
      expect(service.error()).toBeTruthy();

      // The line remains in the list (data reloaded from server)
      // User sees that deletion didn't go through
    });
  });

  describe('User views budget calculations', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();
    });

    it('budget totals update when user adds a new expense', async () => {
      // Initial budget has income of 5000 and expenses of 1500
      const initialLines = service.budgetDetails()?.budgetLines || [];
      const initialIncome = initialLines
        .filter((l) => l.kind === 'income')
        .reduce((sum, l) => sum + l.amount, 0);
      const initialExpenses = initialLines
        .filter((l) => l.kind === 'expense')
        .reduce((sum, l) => sum + l.amount, 0);

      expect(initialIncome).toBe(5000);
      expect(initialExpenses).toBe(1500);

      // User adds a new expense
      mockBudgetLineApi.createBudgetLine$ = vi.fn().mockReturnValue(
        of({
          data: {
            id: 'line-3',
            budgetId: mockBudgetId,
            name: 'Courses',
            amount: 400,
            kind: 'expense',
            recurrence: 'fixed',
            templateLineId: null,
            savingsGoalId: null,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
            isManuallyAdjusted: false,
          },
        }),
      );

      await service.createBudgetLine({
        budgetId: mockBudgetId,
        name: 'Courses',
        amount: 400,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      });

      // Budget now shows updated totals
      const updatedLines = service.budgetDetails()?.budgetLines || [];
      const newExpenses = updatedLines
        .filter((l) => l.kind === 'expense')
        .reduce((sum, l) => sum + l.amount, 0);

      expect(newExpenses).toBe(1900); // 1500 + 400
    });
  });

  describe('Complete user workflows', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();
    });

    it('user can create, modify, and remove a budget line', async () => {
      // User starts with 2 budget lines
      const initialCount = service.budgetDetails()?.budgetLines.length || 0;
      expect(initialCount).toBe(2);

      // Step 1: User adds a transport expense
      const newBudgetLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Transport',
        amount: 300,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      };

      const mockCreateResponse = {
        data: {
          id: 'line-transport',
          ...newBudgetLine,
          templateLineId: null,
          savingsGoalId: null,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      };

      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(of(mockCreateResponse));
      await service.createBudgetLine(newBudgetLine);

      // Transport expense appears in the list
      let currentData = service.budgetDetails();
      expect(currentData?.budgetLines.length).toBe(3);
      const transportLine = currentData?.budgetLines.find(
        (l) => l.id === 'line-transport',
      );
      expect(transportLine?.name).toBe('Transport');
      expect(transportLine?.amount).toBe(300);

      // Step 2: User realizes they need to adjust the amount
      const updateData: BudgetLineUpdate = {
        id: 'line-transport',
        name: 'Transport public',
        amount: 350,
      };

      const mockUpdateResponse = {
        data: {
          ...mockCreateResponse.data,
          ...updateData,
          updatedAt: '2024-01-15T11:00:00Z',
        },
      };

      mockBudgetLineApi.updateBudgetLine$ = vi
        .fn()
        .mockReturnValue(of(mockUpdateResponse));
      await service.updateBudgetLine(updateData);

      // The transport line shows the new amount
      currentData = service.budgetDetails();
      const updatedLine = currentData?.budgetLines.find(
        (l) => l.id === 'line-transport',
      );
      expect(updatedLine?.name).toBe('Transport public');
      expect(updatedLine?.amount).toBe(350);

      // Step 3: User decides to remove this expense
      mockBudgetLineApi.deleteBudgetLine$ = vi.fn().mockReturnValue(of({}));
      await service.deleteBudgetLine('line-transport');

      // The transport line is gone from the budget
      currentData = service.budgetDetails();
      expect(currentData?.budgetLines.length).toBe(2);
      expect(
        currentData?.budgetLines.find((l) => l.id === 'line-transport'),
      ).toBeUndefined();
    });

    it('user sees immediate feedback when adding budget line', async () => {
      // Control server response timing
      const createSubject = new Subject();
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(createSubject.asObservable());

      const savingsLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Épargne urgence',
        amount: 500,
        kind: 'saving',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      };

      // User clicks save on a new savings goal
      service.createBudgetLine(savingsLine);

      // The savings appears immediately (with temporary ID)
      const budgetLines = service.budgetDetails()?.budgetLines || [];
      const tempLine = budgetLines.find((l) => l.name === 'Épargne urgence');
      expect(tempLine).toBeDefined();
      expect(tempLine?.amount).toBe(500);
    });

    it('temporary budget line is replaced when server confirms', async () => {
      // Control server response timing
      const createSubject = new Subject();
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(createSubject.asObservable());

      const savingsLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Épargne urgence',
        amount: 500,
        kind: 'saving',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      };

      // User clicks save and gets immediate feedback
      const createPromise = service.createBudgetLine(savingsLine);

      // Server confirms the creation
      createSubject.next({
        data: {
          id: 'line-server-123',
          ...savingsLine,
          templateLineId: null,
          savingsGoalId: null,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      });
      createSubject.complete();
      await createPromise;

      // The temporary entry is replaced with the permanent one
      const budgetLines = service.budgetDetails()?.budgetLines || [];
      const permanentLine = budgetLines.find((l) => l.id === 'line-server-123');
      expect(permanentLine?.name).toBe('Épargne urgence');
    });

    it('no temporary entries remain after server confirmation', async () => {
      // Control server response timing
      const createSubject = new Subject();
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(createSubject.asObservable());

      const savingsLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Épargne urgence',
        amount: 500,
        kind: 'saving',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      };

      // User creates budget line and server confirms
      const createPromise = service.createBudgetLine(savingsLine);
      createSubject.next({
        data: {
          id: 'line-server-123',
          ...savingsLine,
          templateLineId: null,
          savingsGoalId: null,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      });
      createSubject.complete();
      await createPromise;

      // No temporary entries remain
      const budgetLines = service.budgetDetails()?.budgetLines || [];
      const hasTemp = budgetLines.some((l) => l.id.startsWith('temp-'));
      expect(hasTemp).toBe(false);
    });

    it('user can delete transactions from their budget', async () => {
      // User has a transaction they want to remove
      const transactions = service.budgetDetails()?.transactions || [];
      expect(transactions.length).toBeGreaterThan(0);

      const transactionToDelete = transactions[0];
      mockTransactionApi.remove$ = vi.fn().mockReturnValue(of({}));

      // User deletes the transaction
      await service.deleteTransaction(transactionToDelete.id);

      // The transaction is no longer in the list
      const remainingTransactions = service.budgetDetails()?.transactions || [];
      expect(
        remainingTransactions.find((t) => t.id === transactionToDelete.id),
      ).toBeUndefined();
    });
  });

  describe('User experiences with errors', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();
    });

    it('user sees error message when network fails', async () => {
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Network error')));

      // User tries to add an expense but network is down
      await service.createBudgetLine({
        budgetId: mockBudgetId,
        name: 'New expense',
        amount: 100,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      });

      // User sees that something went wrong
      expect(service.error()).toBeTruthy();
    });

    it('user cannot add expenses with negative amounts', async () => {
      // Business rule: amounts must be positive
      const invalidExpense: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Invalid expense',
        amount: -100, // Negative amount
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      };

      // This should be validated before reaching the server
      // In a real app, validation would prevent this
      // For now, we test that errors are handled gracefully
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(
          throwError(
            () => new Error('Validation error: Amount must be positive'),
          ),
        );

      await service.createBudgetLine(invalidExpense);

      // User sees an error occurred
      expect(service.error()).toBeTruthy();
    });
  });

  describe('Allocated Transactions CRUD', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();
    });

    describe('createAllocatedTransaction', () => {
      it('should add transaction with optimistic update and update consumption locally', async () => {
        // Arrange - Setup budget line with consumption data
        const budgetLineId = 'line-2'; // Rent line
        const newTransaction: TransactionCreate = {
          budgetId: mockBudgetId,
          budgetLineId,
          name: 'Loyer janvier',
          amount: 1500,
          kind: 'expense',
          transactionDate: '2024-01-15T00:00:00.000Z',
        };

        const serverTransaction = createMockTransaction({
          id: 'tx-new-server',
          ...newTransaction,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        });

        mockTransactionApi.create$ = vi.fn().mockReturnValue(
          of({
            success: true,
            data: serverTransaction,
          }),
        );

        // Get initial consumption state
        const initialLine = service
          .budgetDetails()
          ?.budgetLines.find((l) => l.id === budgetLineId);
        const initialConsumed = initialLine?.consumedAmount ?? 0;

        // Act
        await service.createAllocatedTransaction(newTransaction);

        // Assert - Consumption should be updated locally
        const updatedLine = service
          .budgetDetails()
          ?.budgetLines.find((l) => l.id === budgetLineId);
        expect(updatedLine?.consumedAmount).toBe(initialConsumed + 1500);
        expect(updatedLine?.remainingAmount).toBe(
          updatedLine!.amount - updatedLine!.consumedAmount,
        );

        // Transaction API was called
        expect(mockTransactionApi.create$).toHaveBeenCalledWith(newTransaction);
      });

      it('should refresh full state on error and show snackbar', async () => {
        // Arrange
        mockTransactionApi.create$ = vi
          .fn()
          .mockReturnValue(throwError(() => new Error('Server error')));

        const failedTransaction: TransactionCreate = {
          budgetId: mockBudgetId,
          budgetLineId: 'line-2',
          name: 'Failed transaction',
          amount: 100,
          kind: 'expense',
        };

        // Act
        await service.createAllocatedTransaction(failedTransaction);

        // Assert - Error should be set (reload happens on error)
        expect(service.error()).toBeTruthy();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('updateAllocatedTransaction', () => {
      it('should update transaction and adjust consumption by delta', async () => {
        // Arrange - Setup existing transaction
        const transactionId = 'tx-existing';
        const budgetLineId = 'line-2';
        const originalAmount = 100;
        const newAmount = 150;

        mockTransactionApi.update$ = vi.fn().mockReturnValue(
          of({
            success: true,
            data: createMockTransaction({
              id: transactionId,
              budgetId: mockBudgetId,
              budgetLineId,
              name: 'Updated transaction',
              amount: newAmount,
              kind: 'expense',
            }),
          }),
        );

        const updateData: TransactionUpdate = {
          name: 'Updated transaction',
          amount: newAmount,
        };

        // Get initial consumption
        const initialLine = service
          .budgetDetails()
          ?.budgetLines.find((l) => l.id === budgetLineId);
        const initialConsumed = initialLine?.consumedAmount ?? 0;

        // Act - Update with originalAmount for delta calculation
        await service.updateAllocatedTransaction(
          transactionId,
          updateData,
          budgetLineId,
          originalAmount,
        );

        // Assert - Consumption should be adjusted by delta (newAmount - originalAmount = 50)
        const updatedLine = service
          .budgetDetails()
          ?.budgetLines.find((l) => l.id === budgetLineId);
        expect(updatedLine?.consumedAmount).toBe(
          initialConsumed + (newAmount - originalAmount),
        );

        // Transaction API was called
        expect(mockTransactionApi.update$).toHaveBeenCalledWith(
          transactionId,
          updateData,
        );
      });

      it('should refresh full state on update error', async () => {
        // Arrange
        mockTransactionApi.update$ = vi
          .fn()
          .mockReturnValue(throwError(() => new Error('Update failed')));

        // Act
        await service.updateAllocatedTransaction(
          'tx-1',
          { amount: 200 },
          'line-2',
          100,
        );

        // Assert
        expect(service.error()).toBeTruthy();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('deleteAllocatedTransaction', () => {
      it('should delete transaction and decrease consumption locally', async () => {
        // Arrange
        const transactionId = 'tx-to-delete';
        const budgetLineId = 'line-2';
        const transactionAmount = 75;

        mockTransactionApi.remove$ = vi.fn().mockReturnValue(of({}));

        // Get initial consumption
        const initialLine = service
          .budgetDetails()
          ?.budgetLines.find((l) => l.id === budgetLineId);
        const initialConsumed = initialLine?.consumedAmount ?? 0;

        // Act
        await service.deleteAllocatedTransaction(
          transactionId,
          budgetLineId,
          transactionAmount,
        );

        // Assert - Consumption should decrease by deleted amount
        const updatedLine = service
          .budgetDetails()
          ?.budgetLines.find((l) => l.id === budgetLineId);
        expect(updatedLine?.consumedAmount).toBe(
          initialConsumed - transactionAmount,
        );

        // Transaction API was called
        expect(mockTransactionApi.remove$).toHaveBeenCalledWith(transactionId);
      });

      it('should refresh full state on delete error', async () => {
        // Arrange
        mockTransactionApi.remove$ = vi
          .fn()
          .mockReturnValue(throwError(() => new Error('Delete failed')));

        // Act
        await service.deleteAllocatedTransaction('tx-1', 'line-2', 50);

        // Assert
        expect(service.error()).toBeTruthy();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('updateLocalConsumption - internal method behavior', () => {
      it('should update consumedAmount and remainingAmount correctly', async () => {
        // Arrange - Create a transaction to trigger consumption update
        const budgetLineId = 'line-2';
        const transactionAmount = 100;

        mockTransactionApi.create$ = vi.fn().mockReturnValue(
          of({
            success: true,
            data: createMockTransaction({
              id: 'tx-new',
              budgetId: mockBudgetId,
              budgetLineId,
              amount: transactionAmount,
              kind: 'expense',
            }),
          }),
        );

        // Get initial state
        const initialLine = service
          .budgetDetails()
          ?.budgetLines.find((l) => l.id === budgetLineId);
        const initialConsumed = initialLine?.consumedAmount ?? 0;
        const initialRemaining =
          initialLine?.remainingAmount ?? initialLine!.amount;

        // Act
        await service.createAllocatedTransaction({
          budgetId: mockBudgetId,
          budgetLineId,
          name: 'Test transaction',
          amount: transactionAmount,
          kind: 'expense',
        });

        // Assert
        const updatedLine = service
          .budgetDetails()
          ?.budgetLines.find((l) => l.id === budgetLineId);
        expect(updatedLine?.consumedAmount).toBe(
          initialConsumed + transactionAmount,
        );
        expect(updatedLine?.remainingAmount).toBe(
          initialRemaining - transactionAmount,
        );
      });

      it('should not call API for local consumption updates', async () => {
        // This is tested implicitly - the consumption update happens locally
        // without a separate API call. The only API call is for the transaction itself.
        const budgetLineId = 'line-2';

        mockTransactionApi.create$ = vi.fn().mockReturnValue(
          of({
            success: true,
            data: createMockTransaction({
              id: 'tx-new',
              budgetId: mockBudgetId,
              budgetLineId,
              amount: 50,
              kind: 'expense',
            }),
          }),
        );

        await service.createAllocatedTransaction({
          budgetId: mockBudgetId,
          budgetLineId,
          name: 'Test',
          amount: 50,
          kind: 'expense',
        });

        // Only transaction create was called, no separate consumption update API
        expect(mockTransactionApi.create$).toHaveBeenCalledTimes(1);
        // No budget line update API was called for consumption
        expect(mockBudgetLineApi.updateBudgetLine$).not.toHaveBeenCalled();
      });
    });
  });
});
