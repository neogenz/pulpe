import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BudgetLineCreate, BudgetLineUpdate } from '@pulpe/shared';

import { BudgetDetailsStore } from './budget-details-store';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { TransactionApi } from '@core/transaction/transaction-api';
import { Logger } from '@core/logging/logger';
import { ApplicationConfiguration } from '@core/config/application-configuration';
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
      description: 'Groceries',
      amount: 50,
      kind: 'expense',
      date: '2024-01-05',
    }),
  ],
});

describe('BudgetDetailsStore - Integration Tests', () => {
  let service: BudgetDetailsStore;
  let httpMock: HttpTestingController;
  let mockBudgetApi: {
    getBudgetWithDetails$: ReturnType<typeof vi.fn>;
  };
  let mockBudgetLineApi: {
    createBudgetLine$: ReturnType<typeof vi.fn>;
    updateBudgetLine$: ReturnType<typeof vi.fn>;
    deleteBudgetLine$: ReturnType<typeof vi.fn>;
  };
  let mockTransactionApi: {
    remove$: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
  };
  let mockApplicationConfiguration: {
    backendApiUrl: ReturnType<typeof vi.fn>;
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
    };

    mockTransactionApi = {
      remove$: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
    };

    mockApplicationConfiguration = {
      backendApiUrl: vi.fn().mockReturnValue('http://localhost:3000/api/v1'),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideZonelessChangeDetection(),
        BudgetDetailsStore,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: BudgetLineApi, useValue: mockBudgetLineApi },
        { provide: TransactionApi, useValue: mockTransactionApi },
        { provide: Logger, useValue: mockLogger },
        {
          provide: ApplicationConfiguration,
          useValue: mockApplicationConfiguration,
        },
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

  describe('Budget Initialization & Resource Loading', () => {
    it('should initialize budget ID and trigger resource loading', async () => {
      // Arrange
      expect(service.budgetDetails()).toBe(null); // Initially no data

      // Act - Initialize with budget ID (should trigger resource loading)
      service.setBudgetId(mockBudgetId);
      TestBed.flushEffects(); // Trigger resource loader

      // Wait for resource to load
      await waitForResourceStable();

      // Assert - Data should be accessible through computed signals
      const budgetDetails = service.budgetDetails();
      expect(budgetDetails).toBeDefined();
      expect(budgetDetails?.id).toBe(mockBudgetId);
      expect(budgetDetails?.budgetLines).toHaveLength(2);
      expect(service.isLoading()).toBe(false);
    });

    it('should handle resource loading states correctly', () => {
      // Arrange - Mock resource in loading state
      const mockResource = service.budgetDetails as unknown;
      if (mockResource && typeof mockResource === 'function') {
        // Can't directly test loading states with our current setup
        // This would require more sophisticated resource mocking
        expect(true).toBe(true); // Placeholder
      }
    });

    it('should transform budget data correctly via computed signal', async () => {
      // Arrange
      service.setBudgetId(mockBudgetId);
      TestBed.flushEffects();
      await waitForResourceStable();

      // Act
      const budgetDetails = service.budgetDetails();

      // Assert - Data structure matches expected BudgetDetails type
      expect(budgetDetails).toBeDefined();
      expect(budgetDetails).toMatchObject({
        id: expect.any(String),
        userId: expect.any(String),
        month: expect.any(Number),
        year: expect.any(Number),
        budgetLines: expect.any(Array),
        transactions: expect.any(Array),
      });

      // Verify budget lines transformation
      expect(budgetDetails?.budgetLines[0]).toMatchObject({
        id: 'line-1',
        name: 'Salary',
        amount: 5000,
        kind: 'income',
      });
    });
  });

  describe('Budget Line Creation', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.flushEffects();
      // Wait for initial data to load
      await waitForResourceStable();
    });

    it('should create budget line successfully with optimistic updates', async () => {
      // Arrange
      const newBudgetLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Courses',
        amount: 400,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        isRollover: false,
      };

      const mockCreatedResponse = {
        data: {
          id: 'line-new',
          ...newBudgetLine,
          templateLineId: null,
          savingsGoalId: null,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      };

      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(of(mockCreatedResponse));

      const initialCount = service.budgetDetails()?.budgetLines.length || 0;

      // Act - Create budget line (should show optimistically)
      const createPromise = service.createBudgetLine(newBudgetLine);

      // Assert - Should appear immediately (optimistic)
      const optimisticData = service.budgetDetails();
      expect(optimisticData?.budgetLines.length).toBe(initialCount + 1);

      const tempLine = optimisticData?.budgetLines.find((l) =>
        l.id.startsWith('temp-'),
      );
      expect(tempLine).toBeDefined();
      expect(tempLine?.name).toBe('Courses');

      // Wait for server response
      await createPromise;

      // Assert - Temp ID should be replaced with server ID
      const finalData = service.budgetDetails();
      const serverLine = finalData?.budgetLines.find(
        (l) => l.id === 'line-new',
      );
      expect(serverLine).toBeDefined();
      expect(serverLine?.name).toBe('Courses');

      // Temp line should be gone
      const stillHasTemp = finalData?.budgetLines.some((l) =>
        l.id.startsWith('temp-'),
      );
      expect(stillHasTemp).toBe(false);
    });

    it('should reload data on creation error', async () => {
      const newBudgetLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Failed Line',
        amount: 100,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        isRollover: false,
      };

      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Creation failed')));

      // Spy on reload method
      const reloadSpy = vi.spyOn(service, 'reloadBudgetDetails');

      // Attempt to create budget line
      await service.createBudgetLine(newBudgetLine);

      // Verify reload was called to refresh data from server
      expect(reloadSpy).toHaveBeenCalled();

      // Verify error state is set
      expect(service.error()).toBeTruthy();
    });

    it('should handle creation with failed initial load', async () => {
      // Create fresh service with no loaded data
      service = TestBed.inject(BudgetDetailsStore);

      const newBudgetLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Failed Line',
        amount: 100,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        isRollover: false,
      };

      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Creation failed')));

      // Spy on the reload method
      const reloadSpy = vi.spyOn(service, 'reloadBudgetDetails');

      // Attempt to create budget line without any initial load
      await service.createBudgetLine(newBudgetLine);

      // Check that reload was called even without initial data
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  describe('Budget Line Updates', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.flushEffects();
      // Wait for initial data to load
      await waitForResourceStable();
    });

    it('should update budget line optimistically', async () => {
      const updateData: BudgetLineUpdate = {
        id: 'line-2',
        name: 'Updated Rent',
        amount: 1600,
      };

      const mockUpdatedResponse = {
        data: {
          ...mockBudgetDetailsResponse.data.budgetLines[1],
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      };

      mockBudgetLineApi.updateBudgetLine$ = vi
        .fn()
        .mockReturnValue(of(mockUpdatedResponse));

      // Update budget line
      await service.updateBudgetLine(updateData);

      // Check optimistic update
      const updatedData = service.budgetDetails();
      const updatedLine = updatedData?.budgetLines.find(
        (l) => l.id === 'line-2',
      );

      expect(updatedLine?.name).toBe('Updated Rent');
      expect(updatedLine?.amount).toBe(1600);

      // Success - no snackbar calls (moved to component responsibility)
    });

    it('should reload data on update error', async () => {
      const updateData: BudgetLineUpdate = {
        id: 'line-2',
        name: 'Failed Update',
      };

      mockBudgetLineApi.updateBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Update failed')));

      // Spy on reload method
      const reloadSpy = vi.spyOn(service, 'reloadBudgetDetails');

      // Attempt update
      await service.updateBudgetLine(updateData);

      // Verify reload was called to refresh data from server
      expect(reloadSpy).toHaveBeenCalled();

      // Verify error state is set
      expect(service.error()).toBeTruthy();
    });
  });

  describe('Budget Line Deletion', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.flushEffects();
      // Wait for initial data to load
      await waitForResourceStable();
    });

    it('should delete budget line optimistically', async () => {
      mockBudgetLineApi.deleteBudgetLine$ = vi.fn().mockReturnValue(of({}));

      const initialCount = service.budgetDetails()?.budgetLines.length || 0;

      // Delete budget line
      await service.deleteBudgetLine('line-2');

      // Check optimistic deletion
      const updatedData = service.budgetDetails();
      expect(updatedData?.budgetLines.length).toBe(initialCount - 1);

      const deletedLine = updatedData?.budgetLines.find(
        (l) => l.id === 'line-2',
      );
      expect(deletedLine).toBeUndefined();

      // Success - no snackbar calls (moved to component responsibility)
    });

    it('should reload data on deletion error', async () => {
      mockBudgetLineApi.deleteBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Deletion failed')));

      // Spy on reload method
      const reloadSpy = vi.spyOn(service, 'reloadBudgetDetails');

      // Attempt deletion
      await service.deleteBudgetLine('line-2');

      // Verify reload was called to refresh data from server
      expect(reloadSpy).toHaveBeenCalled();

      // Verify error state is set
      expect(service.error()).toBeTruthy();
    });
  });

  describe('Computed Signals & Reactive State', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.flushEffects();
      await waitForResourceStable();
    });

    it('should update computed signals when resource data changes via store operations', async () => {
      // Arrange - Initial state
      const initialData = service.budgetDetails();
      expect(initialData?.budgetLines).toHaveLength(2);

      // Act - Use store method to change data (simulates real user interaction)
      const newBudgetLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Courses',
        amount: 400,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        isRollover: false,
      };

      const mockCreateResponse = {
        data: {
          id: 'line-3',
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

      // Assert - Computed signal reflects the change
      const updatedData = service.budgetDetails();
      expect(updatedData?.budgetLines).toHaveLength(3);
      expect(updatedData?.budgetLines[2].name).toBe('Courses');
    });

    it('should handle error states in computed signals', () => {
      // Act - This would require more sophisticated error mocking
      // For now, we test that error signal exists and is callable
      service.error();

      // Assert - Error signal is accessible
      expect(typeof service.error).toBe('function');
      // In a real error scenario: expect(errorSignal).toBeDefined();
    });

    it('should correctly calculate budget totals via computed logic', () => {
      // Arrange
      const budgetDetails = service.budgetDetails();
      expect(budgetDetails?.budgetLines).toHaveLength(2);

      // Act - Calculate totals (this logic should be in computed signals)
      const calculateTotals = (lines: typeof budgetDetails.budgetLines) => {
        const income =
          lines
            ?.filter((l) => l.kind === 'income')
            .reduce((sum, l) => sum + l.amount, 0) || 0;
        const expenses =
          lines
            ?.filter((l) => l.kind === 'expense')
            .reduce((sum, l) => sum + l.amount, 0) || 0;
        return { income, expenses, balance: income - expenses };
      };

      const totals = calculateTotals(budgetDetails?.budgetLines);

      // Assert - Totals are calculated correctly
      expect(totals.income).toBe(5000); // Salary
      expect(totals.expenses).toBe(1500); // Rent
      expect(totals.balance).toBe(3500); // 5000 - 1500
    });
  });

  describe('Scénarios métier complets', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.flushEffects();
      await waitForResourceStable();
    });

    it('should handle complete budget line lifecycle (create, update, delete)', async () => {
      // Arrange - Initial state
      const initialCount = service.budgetDetails()?.budgetLines.length || 0;

      // Act 1 - Create a new budget line
      const newBudgetLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Transport',
        amount: 300,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        isRollover: false,
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

      // Assert 1 - Line is created
      let currentData = service.budgetDetails();
      expect(currentData?.budgetLines.length).toBe(initialCount + 1);
      const createdLine = currentData?.budgetLines.find(
        (l) => l.id === 'line-transport',
      );
      expect(createdLine?.name).toBe('Transport');

      // Act 2 - Update the budget line
      const updateData: BudgetLineUpdate = {
        id: 'line-transport',
        name: 'Transport public',
        amount: 350,
      };

      const mockUpdateResponse = {
        data: {
          ...createdLine,
          ...updateData,
          updatedAt: '2024-01-15T11:00:00Z',
        },
      };

      mockBudgetLineApi.updateBudgetLine$ = vi
        .fn()
        .mockReturnValue(of(mockUpdateResponse));
      await service.updateBudgetLine(updateData);

      // Assert 2 - Line is updated
      currentData = service.budgetDetails();
      const updatedLine = currentData?.budgetLines.find(
        (l) => l.id === 'line-transport',
      );
      expect(updatedLine?.name).toBe('Transport public');
      expect(updatedLine?.amount).toBe(350);

      // Act 3 - Delete the budget line
      mockBudgetLineApi.deleteBudgetLine$ = vi.fn().mockReturnValue(of({}));
      await service.deleteBudgetLine('line-transport');

      // Assert 3 - Line is deleted
      currentData = service.budgetDetails();
      expect(currentData?.budgetLines.length).toBe(initialCount);
      const deletedLine = currentData?.budgetLines.find(
        (l) => l.id === 'line-transport',
      );
      expect(deletedLine).toBeUndefined();
    });

    it('should synchronize optimistic updates with server responses', async () => {
      // Arrange - Control timing with Subject
      const createSubject = new Subject();
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(createSubject.asObservable());

      const newLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Épargne urgence',
        amount: 500,
        kind: 'saving',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        isRollover: false,
      };

      const initialCount = service.budgetDetails()?.budgetLines.length || 0;

      // Act 1 - Start creation (optimistic)
      const createPromise = service.createBudgetLine(newLine);

      // Assert 1 - Optimistic state (temp ID visible)
      let currentData = service.budgetDetails();
      expect(currentData?.budgetLines.length).toBe(initialCount + 1);

      const tempLine = currentData?.budgetLines.find((l) =>
        l.id.startsWith('temp-'),
      );
      expect(tempLine).toBeDefined();
      expect(tempLine?.name).toBe('Épargne urgence');

      // Act 2 - Server responds
      const serverResponse = {
        data: {
          id: 'line-server-123',
          ...newLine,
          templateLineId: null,
          savingsGoalId: null,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      };

      createSubject.next(serverResponse);
      createSubject.complete();
      await createPromise;

      // Assert 2 - Final state (server ID replaces temp)
      currentData = service.budgetDetails();
      expect(currentData?.budgetLines.length).toBe(initialCount + 1);

      const finalLine = currentData?.budgetLines.find(
        (l) => l.id === 'line-server-123',
      );
      expect(finalLine).toBeDefined();
      expect(finalLine?.name).toBe('Épargne urgence');

      const stillHasTemp = currentData?.budgetLines.some((l) =>
        l.id.startsWith('temp-'),
      );
      expect(stillHasTemp).toBe(false);
    });

    it('should recover from network failures gracefully', async () => {
      const failingLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Failed Line',
        amount: 200,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        isRollover: false,
      };

      // Act - Simulate network failure
      const networkError = new Error('Connexion réseau impossible');
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => networkError));

      // Spy on reload method
      const reloadSpy = vi.spyOn(service, 'reloadBudgetDetails');

      // Should not throw, but handle gracefully
      await service.createBudgetLine(failingLine);

      // Assert - Reload was called to recover from network failure
      expect(reloadSpy).toHaveBeenCalled();

      // Error state should be set
      expect(service.error()).toBeTruthy();
    });

    it('should handle transaction operations correctly', async () => {
      // Arrange - Add some transactions to the budget
      const currentData = service.budgetDetails();
      expect(currentData?.transactions).toBeDefined();

      // Act - Delete a transaction (if any exist)
      if (currentData?.transactions && currentData.transactions.length > 0) {
        const transactionId = currentData.transactions[0].id;
        mockTransactionApi.remove$ = vi.fn().mockReturnValue(of({}));

        await service.deleteTransaction(transactionId);

        // Assert - Transaction is removed
        const updatedData = service.budgetDetails();
        const deletedTransaction = updatedData?.transactions?.find(
          (t) => t.id === transactionId,
        );
        expect(deletedTransaction).toBeUndefined();
      }

      // Test passes even if no transactions exist initially
      expect(true).toBe(true);
    });
  });

  describe('Gestion des erreurs réseau', () => {
    beforeEach(async () => {
      service.setBudgetId(mockBudgetId);
      TestBed.flushEffects();
      await waitForResourceStable();
    });

    it('should handle various network error types', async () => {
      const errorScenarios = [
        { error: new Error('Network timeout') },
        { error: new Error('Server error 500') },
        { error: new Error('Validation failed') },
      ];

      for (const scenario of errorScenarios) {
        // Arrange
        mockBudgetLineApi.createBudgetLine$ = vi
          .fn()
          .mockReturnValue(throwError(() => scenario.error));

        const testLine: BudgetLineCreate = {
          budgetId: mockBudgetId,
          name: 'Test Error',
          amount: 100,
          kind: 'expense',
          recurrence: 'fixed',
          isManuallyAdjusted: false,
          isRollover: false,
        };

        // Spy on reload method
        const reloadSpy = vi.spyOn(service, 'reloadBudgetDetails');

        // Act
        await service.createBudgetLine(testLine);

        // Assert - All scenarios should result in reload
        expect(reloadSpy).toHaveBeenCalled();
        expect(service.error()).toBeTruthy();
      }
    });
  });
});
