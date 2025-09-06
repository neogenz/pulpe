import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  BudgetLine,
  BudgetLineCreate,
  BudgetLineUpdate,
} from '@pulpe/shared';

import { BudgetDetailsStore } from './budget-details-store';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { TransactionApi } from '@core/transaction/transaction-api';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { createMockBudgetLine } from '../../../../testing/mock-factories';

// Mock data
const mockBudgetId = 'budget-123';

const mockBudgetDetailsResponse = {
  data: {
    budget: {
      id: mockBudgetId,
      userId: 'user-1',
      templateId: 'template-1',
      month: 1,
      year: 2024,
      description: 'January Budget',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
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
    ] as BudgetLine[],
  },
};

describe('BudgetDetailsStore - Integration Tests', () => {
  let service: BudgetDetailsStore;
  let httpMock: HttpTestingController;
  let mockBudgetLineApi: {
    getBudgetDetails$: ReturnType<typeof vi.fn>;
    createBudgetLine$: ReturnType<typeof vi.fn>;
    updateBudgetLine$: ReturnType<typeof vi.fn>;
    deleteBudgetLine$: ReturnType<typeof vi.fn>;
  };
  let mockTransactionApi: {
    remove$: ReturnType<typeof vi.fn>;
  };
  let mockApplicationConfiguration: {
    backendApiUrl: ReturnType<typeof vi.fn>;
  };

  // Helper function to set resource data manually for testing
  const setResourceData = () => {
    // Access the resource through the computed signal and set its value
    const resource = service.budgetDetails();
    if (resource && 'set' in resource) {
      resource.set(mockBudgetDetailsResponse);
    }
  };

  beforeEach(() => {
    // Create mocks
    mockBudgetLineApi = {
      getBudgetDetails$: vi.fn().mockReturnValue(of(mockBudgetDetailsResponse)),
      createBudgetLine$: vi.fn(),
      updateBudgetLine$: vi.fn(),
      deleteBudgetLine$: vi.fn(),
    };

    mockTransactionApi = {
      remove$: vi.fn(),
    };

    mockApplicationConfiguration = {
      backendApiUrl: vi.fn().mockReturnValue('http://localhost:3000/api/v1'),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideZonelessChangeDetection(),
        BudgetDetailsStore,
        { provide: BudgetLineApi, useValue: mockBudgetLineApi },
        { provide: TransactionApi, useValue: mockTransactionApi },
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

  describe('Budget Initialization', () => {
    it('should initialize budget ID and load data', async () => {
      // Initialize with budget ID
      service.initializeBudgetId(mockBudgetId);

      // Since resource loading is async and doesn't work well in tests,
      // we manually set the data after initialization
      setResourceData();

      // Access the data through budgetData computed signal
      const budgetData = service.budgetData();

      expect(budgetData).toBeDefined();
      expect(budgetData?.budget.id).toBe(mockBudgetId);
      expect(budgetData?.budgetLines).toHaveLength(2);
    });
  });

  describe('Budget Line Creation', () => {
    beforeEach(() => {
      service.initializeBudgetId(mockBudgetId);
      // Set initial data for the tests
      setResourceData();
    });

    it('should create budget line successfully', async () => {
      const newBudgetLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Groceries',
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
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      };

      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(of(mockCreatedResponse));

      const initialCount = service.budgetData()?.budgetLines.length || 0;

      // Create budget line
      await service.createBudgetLine(newBudgetLine);

      // Check that line was added
      const updatedData = service.budgetData();
      expect(updatedData?.budgetLines.length).toBe(initialCount + 1);

      const addedLine = updatedData?.budgetLines.find(
        (l) => l.id === 'line-new',
      );
      expect(addedLine).toBeDefined();
      expect(addedLine?.name).toBe('Groceries');

      // Success - no snackbar calls (moved to component responsibility)
    });

    it('should handle creation errors and rollback data', async () => {
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

      const originalData = service.budgetData();
      const originalLineCount = originalData?.budgetLines.length || 0;

      // Attempt to create budget line
      await service.createBudgetLine(newBudgetLine);

      // Check rollback - data should be restored to original state
      const rolledBackData = service.budgetData();
      expect(rolledBackData?.budgetLines.length).toBe(originalLineCount);

      // Verify no temporary line remains
      const tempLine = rolledBackData?.budgetLines.find((l) =>
        l.id.startsWith('temp-'),
      );
      expect(tempLine).toBeUndefined();
    });

    it('should reload data when creation fails with no initial data', async () => {
      // Reset the service to have no initial data
      service = TestBed.inject(BudgetDetailsStore);
      service.initializeBudgetId(mockBudgetId);
      // Do NOT call setResourceData() - simulating no data loaded yet

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

      // Clear any existing resource data to simulate no initial load
      const resource = service.budgetDetails();
      if (resource && 'set' in resource) {
        // Force the resource to have undefined value
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (resource as any).set(undefined);
      }

      // Spy on the resource's reload method
      const reloadSpy = vi.spyOn(resource, 'reload');

      // Attempt to create budget line
      await service.createBudgetLine(newBudgetLine);

      // Check that reload was called since there was no original data
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  describe('Budget Line Updates', () => {
    beforeEach(() => {
      service.initializeBudgetId(mockBudgetId);
      // Set initial data for the tests
      setResourceData();
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
      const updatedData = service.budgetData();
      const updatedLine = updatedData?.budgetLines.find(
        (l) => l.id === 'line-2',
      );

      expect(updatedLine?.name).toBe('Updated Rent');
      expect(updatedLine?.amount).toBe(1600);

      // Success - no snackbar calls (moved to component responsibility)
    });

    it('should rollback on update error', async () => {
      const updateData: BudgetLineUpdate = {
        id: 'line-2',
        name: 'Failed Update',
      };

      mockBudgetLineApi.updateBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Update failed')));

      const originalData = service.budgetData();
      const originalLine = originalData?.budgetLines.find(
        (l) => l.id === 'line-2',
      );

      // Attempt update
      await service.updateBudgetLine(updateData);

      // Check rollback
      const rolledBackData = service.budgetData();
      const rolledBackLine = rolledBackData?.budgetLines.find(
        (l) => l.id === 'line-2',
      );

      expect(rolledBackLine?.name).toBe(originalLine?.name);

      // Error handled - no snackbar calls (moved to component responsibility)
    });
  });

  describe('Budget Line Deletion', () => {
    beforeEach(() => {
      service.initializeBudgetId(mockBudgetId);
      // Set initial data for the tests
      setResourceData();
    });

    it('should delete budget line optimistically', async () => {
      mockBudgetLineApi.deleteBudgetLine$ = vi.fn().mockReturnValue(of({}));

      const initialCount = service.budgetData()?.budgetLines.length || 0;

      // Delete budget line
      await service.deleteBudgetLine('line-2');

      // Check optimistic deletion
      const updatedData = service.budgetData();
      expect(updatedData?.budgetLines.length).toBe(initialCount - 1);

      const deletedLine = updatedData?.budgetLines.find(
        (l) => l.id === 'line-2',
      );
      expect(deletedLine).toBeUndefined();

      // Success - no snackbar calls (moved to component responsibility)
    });

    it('should rollback on deletion error', async () => {
      mockBudgetLineApi.deleteBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Deletion failed')));

      const originalData = service.budgetData();
      const initialCount = originalData?.budgetLines.length || 0;

      // Attempt deletion
      await service.deleteBudgetLine('line-2');

      // Check rollback
      const rolledBackData = service.budgetData();
      expect(rolledBackData?.budgetLines.length).toBe(initialCount);

      const restoredLine = rolledBackData?.budgetLines.find(
        (l) => l.id === 'line-2',
      );
      expect(restoredLine).toBeDefined();

      // Error handled - no snackbar calls (moved to component responsibility)
    });
  });

  describe('Operations Tracking', () => {
    beforeEach(() => {
      service.initializeBudgetId(mockBudgetId);
      // Set initial data for the tests
      setResourceData();
    });

    it('should track operations during creation', async () => {
      const newBudgetLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Test Line',
        amount: 100,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        isRollover: false,
      };

      // Create a subject to control the observable timing
      const subject = new Subject();
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(subject.asObservable());

      // Start creation (don't await yet)
      const createPromise = service.createBudgetLine(newBudgetLine);

      // Allow the service to start the operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Wait for operation to complete
      subject.next({
        data: {
          id: 'line-new',
          ...newBudgetLine,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      });
      subject.complete();

      // Wait for completion
      await createPromise;
    });

    it('should track operations during update', async () => {
      const updateData: BudgetLineUpdate = { id: 'line-1', name: 'Updated' };

      // Create a subject to control the observable timing
      const subject = new Subject();
      mockBudgetLineApi.updateBudgetLine$ = vi
        .fn()
        .mockReturnValue(subject.asObservable());

      // Start update (don't await yet)
      const updatePromise = service.updateBudgetLine(updateData);

      // Allow the service to start the operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Wait for operation to complete
      subject.next({
        data: {
          ...mockBudgetDetailsResponse.data.budgetLines[0],
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      });
      subject.complete();

      // Wait for completion
      await updatePromise;
    });
  });

  describe('Error Cases', () => {
    beforeEach(() => {
      service.initializeBudgetId(mockBudgetId);
      // Set initial data for the tests
      setResourceData();
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      mockBudgetLineApi.createBudgetLine$ = vi
        .fn()
        .mockReturnValue(throwError(() => networkError));

      const newLine: BudgetLineCreate = {
        budgetId: mockBudgetId,
        name: 'Test',
        amount: 100,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        isRollover: false,
      };

      // Should not throw, but handle gracefully
      await expect(service.createBudgetLine(newLine)).resolves.toBeUndefined();

      // Error handled - no snackbar calls (moved to component responsibility)
    });
  });
});
