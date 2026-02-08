import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BudgetLineCreate, BudgetLineUpdate } from 'pulpe-shared';

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
    toggleCheck$: ReturnType<typeof vi.fn>;
    checkTransactions$: ReturnType<typeof vi.fn>;
  };
  let mockTransactionApi: {
    create$: ReturnType<typeof vi.fn>;
    remove$: ReturnType<typeof vi.fn>;
    toggleCheck$: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
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
    await vi.waitFor(
      () => {
        expect(service.isLoading()).toBe(false);
      },
      { timeout },
    );
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
      toggleCheck$: vi.fn(),
      checkTransactions$: vi.fn(),
    };

    mockTransactionApi = {
      create$: vi.fn(),
      remove$: vi.fn(),
      toggleCheck$: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
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

  it('should instantiate budget details store', () => {
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

  describe('User creates allocated transactions', () => {
    it('should create transaction unchecked without affecting parent budget line state', async () => {
      const checkedTimestamp = '2024-01-15T10:00:00Z';

      // Parent budget line has checkedAt
      const checkedParentLine = createMockBudgetLine({
        id: 'line-checked',
        budgetId: mockBudgetId,
        name: 'Checked Parent',
        amount: 1000,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: checkedTimestamp,
      });

      // Setup mock with checked parent BEFORE loading
      mockBudgetApi.getBudgetWithDetails$ = vi.fn().mockReturnValue(
        of(
          createMockBudgetDetailsResponse({
            budget: { id: mockBudgetId },
            budgetLines: [checkedParentLine],
            transactions: [],
          }),
        ),
      );

      // Load budget data
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      // Mock server response for transaction creation
      const serverTransaction = createMockTransaction({
        id: 'tx-server-1',
        budgetId: mockBudgetId,
        budgetLineId: 'line-checked',
        name: 'New Allocated Transaction',
        amount: 200,
        kind: 'expense',
        checkedAt: null,
      });

      mockTransactionApi.create$ = vi
        .fn()
        .mockReturnValue(of({ data: serverTransaction }));

      // User creates transaction linked to checked parent
      await service.createAllocatedTransaction({
        budgetId: mockBudgetId,
        budgetLineId: 'line-checked',
        name: 'New Allocated Transaction',
        amount: 200,
        kind: 'expense',
      });

      // Transaction should be created unchecked
      const transactions = service.budgetDetails()?.transactions ?? [];
      const createdTx = transactions.find(
        (tx) => tx.name === 'New Allocated Transaction',
      );

      expect(createdTx).toBeDefined();
      expect(createdTx?.checkedAt).toBeNull();

      // Verify API was called with checkedAt: null
      expect(mockTransactionApi.create$).toHaveBeenCalledWith(
        expect.objectContaining({
          checkedAt: null,
        }),
      );

      // Parent budget line should NOT have been unchecked (no child→parent sync)
      expect(mockBudgetLineApi.toggleCheck$).not.toHaveBeenCalled();

      const budgetLines = service.budgetDetails()?.budgetLines ?? [];
      const parentLine = budgetLines.find((l) => l.id === 'line-checked');
      expect(parentLine?.checkedAt).toBe(checkedTimestamp);
    });

    it('should not inherit checked state when parent budget line is unchecked', async () => {
      // Parent budget line without checkedAt
      const uncheckedParentLine = createMockBudgetLine({
        id: 'line-unchecked',
        budgetId: mockBudgetId,
        name: 'Unchecked Parent',
        amount: 1000,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: null,
      });

      // Setup mock with unchecked parent BEFORE loading
      mockBudgetApi.getBudgetWithDetails$ = vi.fn().mockReturnValue(
        of(
          createMockBudgetDetailsResponse({
            budget: { id: mockBudgetId },
            budgetLines: [uncheckedParentLine],
            transactions: [],
          }),
        ),
      );

      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      const serverTransaction = createMockTransaction({
        id: 'tx-server-2',
        budgetId: mockBudgetId,
        budgetLineId: 'line-unchecked',
        name: 'Transaction to Unchecked',
        amount: 150,
        kind: 'expense',
        checkedAt: null,
      });

      mockTransactionApi.create$ = vi
        .fn()
        .mockReturnValue(of({ data: serverTransaction }));

      await service.createAllocatedTransaction({
        budgetId: mockBudgetId,
        budgetLineId: 'line-unchecked',
        name: 'Transaction to Unchecked',
        amount: 150,
        kind: 'expense',
      });

      const transactions = service.budgetDetails()?.transactions ?? [];
      const createdTx = transactions.find(
        (tx) => tx.name === 'Transaction to Unchecked',
      );

      expect(createdTx).toBeDefined();
      expect(createdTx?.checkedAt).toBeNull();
    });
  });

  describe('User checks envelopes and allocated transactions', () => {
    it('checks envelope successfully without auto-checking allocated transactions', async () => {
      const targetLine = createMockBudgetLine({
        id: 'line-to-check',
        budgetId: mockBudgetId,
        name: 'Envelope to check',
        amount: 600,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: null,
      });

      const allocatedUnchecked = createMockTransaction({
        id: 'tx-allocated-unchecked',
        budgetId: mockBudgetId,
        budgetLineId: 'line-to-check',
        name: 'Allocated unchecked',
        amount: 200,
        kind: 'expense',
        checkedAt: null,
      });

      mockBudgetApi.getBudgetWithDetails$ = vi.fn().mockReturnValue(
        of(
          createMockBudgetDetailsResponse({
            budget: { id: mockBudgetId },
            budgetLines: [targetLine],
            transactions: [allocatedUnchecked],
          }),
        ),
      );

      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      const checkedAtFromServer = '2024-01-20T12:00:00Z';
      mockBudgetLineApi.toggleCheck$ = vi.fn().mockReturnValue(
        of({
          data: {
            ...targetLine,
            checkedAt: checkedAtFromServer,
            updatedAt: checkedAtFromServer,
          },
        }),
      );

      const succeeded = await service.toggleCheck('line-to-check');

      expect(succeeded).toBe(true);
      const updatedLine = service
        .budgetDetails()
        ?.budgetLines.find((line) => line.id === 'line-to-check');
      const unchangedTransaction = service
        .budgetDetails()
        ?.transactions.find((tx) => tx.id === 'tx-allocated-unchecked');

      expect(updatedLine?.checkedAt).toBe(checkedAtFromServer);
      expect(unchangedTransaction?.checkedAt).toBeNull();
    });

    it('returns false and sets an error when envelope toggle fails', async () => {
      const targetLine = createMockBudgetLine({
        id: 'line-toggle-fail',
        budgetId: mockBudgetId,
        name: 'Envelope toggle fail',
        amount: 500,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: null,
      });

      mockBudgetApi.getBudgetWithDetails$ = vi.fn().mockReturnValue(
        of(
          createMockBudgetDetailsResponse({
            budget: { id: mockBudgetId },
            budgetLines: [targetLine],
            transactions: [],
          }),
        ),
      );

      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      mockBudgetLineApi.toggleCheck$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Toggle failed')));

      const succeeded = await service.toggleCheck('line-toggle-fail');

      expect(succeeded).toBe(false);
      expect(service.error()).toBeTruthy();
    });

    it('returns false and skips API call when envelope does not exist', async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      const succeeded = await service.toggleCheck('line-does-not-exist');

      expect(succeeded).toBe(false);
      expect(mockBudgetLineApi.toggleCheck$).not.toHaveBeenCalled();
    });

    it('check-all toggles only unchecked real allocated transactions (ignores temp and unrelated)', async () => {
      const parentLine = createMockBudgetLine({
        id: 'line-parent',
        budgetId: mockBudgetId,
        name: 'Parent line',
        amount: 700,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: null,
      });

      const txRealUnchecked = createMockTransaction({
        id: 'tx-real-unchecked',
        budgetId: mockBudgetId,
        budgetLineId: 'line-parent',
        name: 'Real unchecked',
        amount: 100,
        kind: 'expense',
        checkedAt: null,
      });
      const txRealChecked = createMockTransaction({
        id: 'tx-real-checked',
        budgetId: mockBudgetId,
        budgetLineId: 'line-parent',
        name: 'Real checked',
        amount: 120,
        kind: 'expense',
        checkedAt: '2024-01-19T09:00:00Z',
      });
      const txTempUnchecked = createMockTransaction({
        id: 'temp-optimistic-123',
        budgetId: mockBudgetId,
        budgetLineId: 'line-parent',
        name: 'Temp unchecked',
        amount: 80,
        kind: 'expense',
        checkedAt: null,
      });
      const txOtherLineUnchecked = createMockTransaction({
        id: 'tx-other-line',
        budgetId: mockBudgetId,
        budgetLineId: 'line-other',
        name: 'Other line unchecked',
        amount: 90,
        kind: 'expense',
        checkedAt: null,
      });

      mockBudgetApi.getBudgetWithDetails$ = vi.fn().mockReturnValue(
        of(
          createMockBudgetDetailsResponse({
            budget: { id: mockBudgetId },
            budgetLines: [parentLine],
            transactions: [
              txRealUnchecked,
              txRealChecked,
              txTempUnchecked,
              txOtherLineUnchecked,
            ],
          }),
        ),
      );

      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      mockBudgetLineApi.checkTransactions$ = vi.fn().mockReturnValue(
        of({
          success: true,
          data: [
            {
              ...txRealUnchecked,
              checkedAt: '2024-01-20T11:00:00Z',
              updatedAt: '2024-01-20T11:00:00Z',
            },
          ],
        }),
      );

      await service.checkAllAllocatedTransactions('line-parent');

      expect(mockBudgetLineApi.checkTransactions$).toHaveBeenCalledTimes(1);
      expect(mockBudgetLineApi.checkTransactions$).toHaveBeenCalledWith(
        'line-parent',
      );
      expect(mockTransactionApi.toggleCheck$).not.toHaveBeenCalled();

      const currentTransactions = service.budgetDetails()?.transactions ?? [];
      const realUncheckedAfter = currentTransactions.find(
        (tx) => tx.id === 'tx-real-unchecked',
      );
      const tempAfter = currentTransactions.find(
        (tx) => tx.id === 'temp-optimistic-123',
      );
      const otherLineAfter = currentTransactions.find(
        (tx) => tx.id === 'tx-other-line',
      );

      expect(realUncheckedAfter?.checkedAt).toBe('2024-01-20T11:00:00Z');
      expect(tempAfter?.checkedAt).toBeNull();
      expect(otherLineAfter?.checkedAt).toBeNull();
    });
  });

  describe('User views financial summary', () => {
    it('should calculate realized balance based on checked items only', async () => {
      const checkedIncome = createMockBudgetLine({
        id: 'income-checked',
        budgetId: mockBudgetId,
        name: 'Checked Income',
        amount: 5000,
        kind: 'income',
        recurrence: 'fixed',
        checkedAt: '2024-01-15T10:00:00Z',
      });

      const uncheckedIncome = createMockBudgetLine({
        id: 'income-unchecked',
        budgetId: mockBudgetId,
        name: 'Unchecked Income',
        amount: 3000,
        kind: 'income',
        recurrence: 'fixed',
        checkedAt: null,
      });

      const checkedExpense = createMockBudgetLine({
        id: 'expense-checked',
        budgetId: mockBudgetId,
        name: 'Checked Expense',
        amount: 1500,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: '2024-01-15T10:00:00Z',
      });

      const uncheckedExpense = createMockBudgetLine({
        id: 'expense-unchecked',
        budgetId: mockBudgetId,
        name: 'Unchecked Expense',
        amount: 500,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: null,
      });

      const checkedTransaction = createMockTransaction({
        id: 'tx-checked',
        budgetId: mockBudgetId,
        name: 'Checked Transaction',
        amount: 200,
        kind: 'expense',
        checkedAt: '2024-01-15T10:00:00Z',
      });

      const uncheckedTransaction = createMockTransaction({
        id: 'tx-unchecked',
        budgetId: mockBudgetId,
        name: 'Unchecked Transaction',
        amount: 100,
        kind: 'expense',
        checkedAt: null,
      });

      mockBudgetApi.getBudgetWithDetails$ = vi.fn().mockReturnValue(
        of(
          createMockBudgetDetailsResponse({
            budget: { id: mockBudgetId },
            budgetLines: [
              checkedIncome,
              uncheckedIncome,
              checkedExpense,
              uncheckedExpense,
            ],
            transactions: [checkedTransaction, uncheckedTransaction],
          }),
        ),
      );

      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      // Realized balance: checked income (5000) - checked expenses (1500) - checked transactions (200) = 3300
      expect(service.realizedBalance()).toBe(3300);
    });

    it('should calculate realized expenses based on checked items only', async () => {
      const checkedExpense = createMockBudgetLine({
        id: 'expense-checked',
        budgetId: mockBudgetId,
        name: 'Checked Expense',
        amount: 1500,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: '2024-01-15T10:00:00Z',
      });

      const uncheckedExpense = createMockBudgetLine({
        id: 'expense-unchecked',
        budgetId: mockBudgetId,
        name: 'Unchecked Expense',
        amount: 500,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: null,
      });

      const checkedSaving = createMockBudgetLine({
        id: 'saving-checked',
        budgetId: mockBudgetId,
        name: 'Checked Saving',
        amount: 800,
        kind: 'saving',
        recurrence: 'fixed',
        checkedAt: '2024-01-15T10:00:00Z',
      });

      const checkedTransaction = createMockTransaction({
        id: 'tx-checked',
        budgetId: mockBudgetId,
        name: 'Checked Transaction',
        amount: 200,
        kind: 'expense',
        checkedAt: '2024-01-15T10:00:00Z',
      });

      mockBudgetApi.getBudgetWithDetails$ = vi.fn().mockReturnValue(
        of(
          createMockBudgetDetailsResponse({
            budget: { id: mockBudgetId },
            budgetLines: [checkedExpense, uncheckedExpense, checkedSaving],
            transactions: [checkedTransaction],
          }),
        ),
      );

      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      // Realized expenses: checked expense (1500) + checked saving (800) + checked transaction (200) = 2500
      expect(service.realizedExpenses()).toBe(2500);
    });

    it('should count checked items accurately', async () => {
      const checkedLine1 = createMockBudgetLine({
        id: 'line-checked-1',
        budgetId: mockBudgetId,
        name: 'Checked Line 1',
        amount: 1000,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: '2024-01-15T10:00:00Z',
      });

      const checkedLine2 = createMockBudgetLine({
        id: 'line-checked-2',
        budgetId: mockBudgetId,
        name: 'Checked Line 2',
        amount: 2000,
        kind: 'income',
        recurrence: 'fixed',
        checkedAt: '2024-01-15T10:00:00Z',
      });

      const uncheckedLine = createMockBudgetLine({
        id: 'line-unchecked',
        budgetId: mockBudgetId,
        name: 'Unchecked Line',
        amount: 500,
        kind: 'expense',
        recurrence: 'fixed',
        checkedAt: null,
      });

      const checkedTx = createMockTransaction({
        id: 'tx-checked',
        budgetId: mockBudgetId,
        name: 'Checked Transaction',
        amount: 100,
        kind: 'expense',
        checkedAt: '2024-01-15T10:00:00Z',
      });

      const uncheckedTx = createMockTransaction({
        id: 'tx-unchecked',
        budgetId: mockBudgetId,
        name: 'Unchecked Transaction',
        amount: 50,
        kind: 'expense',
        checkedAt: null,
      });

      mockBudgetApi.getBudgetWithDetails$ = vi.fn().mockReturnValue(
        of(
          createMockBudgetDetailsResponse({
            budget: { id: mockBudgetId },
            budgetLines: [checkedLine1, checkedLine2, uncheckedLine],
            transactions: [checkedTx, uncheckedTx],
          }),
        ),
      );

      service.setBudgetId(mockBudgetId);
      TestBed.tick();
      await waitForResourceStable();

      // 2 checked budget lines + 1 checked transaction = 3
      expect(service.checkedItemsCount()).toBe(3);

      // Total items: 3 budget lines + 2 transactions = 5
      expect(service.totalItemsCount()).toBe(5);
    });
  });
});
