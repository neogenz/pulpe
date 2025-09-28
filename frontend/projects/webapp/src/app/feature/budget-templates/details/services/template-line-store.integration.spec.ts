import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TemplateLineStore } from './template-line-store';
import { BudgetTemplatesApi } from '../../services/budget-templates-api';
import {
  TransactionFormService,
  type TransactionFormData,
} from '../../services/transaction-form';
import { type TransactionKind, type TemplateLine } from '@pulpe/shared';

describe('TemplateLineStore - Integration Tests', () => {
  let store: TemplateLineStore;
  let mockBudgetTemplatesApi: {
    bulkOperationsTemplateLines$: ReturnType<typeof vi.fn>;
  };

  const templateId = 'template-123';
  const mockTemplateLines: TemplateLine[] = [
    {
      id: 'line-1',
      templateId,
      name: 'Loyer',
      amount: 1200,
      kind: 'expense' as TransactionKind,
      recurrence: 'fixed',
      description: 'Monthly rent payment',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'line-2',
      templateId,
      name: 'Salaire',
      amount: 5000,
      kind: 'income' as TransactionKind,
      recurrence: 'fixed',
      description: 'Monthly salary',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockTransactionData: TransactionFormData[] = [
    {
      description: 'Loyer',
      amount: 1200,
      type: 'expense',
    },
    {
      description: 'Salaire',
      amount: 5000,
      type: 'income',
    },
  ];

  beforeEach(() => {
    mockBudgetTemplatesApi = {
      bulkOperationsTemplateLines$: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TemplateLineStore,
        { provide: BudgetTemplatesApi, useValue: mockBudgetTemplatesApi },
        { provide: TransactionFormService, useValue: {} },
      ],
    });

    store = TestBed.inject(TemplateLineStore);
    store.initialize(mockTemplateLines, mockTransactionData);
  });

  describe('API Integration - Successful Operations', () => {
    it('should handle create operation successfully', async () => {
      const newTransaction = {
        description: 'Transport',
        amount: 150,
        type: 'expense' as const,
      };

      // Add new line
      store.addTransaction(newTransaction);

      // Mock API response
      const mockApiResponse = {
        data: {
          created: [
            {
              id: 'new-line-1',
              templateId,
              name: 'Transport',
              amount: 150,
              kind: 'expense' as TransactionKind,
              recurrence: 'fixed',
              description: '',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          updated: [],
          deleted: [],
        },
      };

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of(mockApiResponse),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(1);
      expect(result.updatedLines![0].name).toBe('Transport');

      // Verify API was called with correct data
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).toHaveBeenCalledWith(templateId, {
        create: [
          {
            name: 'Transport',
            amount: 150,
            kind: 'expense',
            recurrence: 'fixed',
            description: '',
          },
        ],
        update: [],
        delete: [],
        propagateToBudgets: false,
      });
    });

    it('should handle update operation successfully', async () => {
      // Update existing line by its ID
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, {
        description: 'Loyer modifié',
        amount: 1300,
      });

      // Mock API response
      const mockApiResponse = {
        data: {
          created: [],
          updated: [
            {
              id: 'line-1',
              templateId,
              name: 'Loyer modifié',
              amount: 1300,
              kind: 'expense' as TransactionKind,
              recurrence: 'fixed',
              description: 'Monthly rent payment',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          deleted: [],
        },
      };

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of(mockApiResponse),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(1);
      expect(result.updatedLines![0].name).toBe('Loyer modifié');
      expect(result.updatedLines![0].amount).toBe(1300);

      // Verify API was called with correct data
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).toHaveBeenCalledWith(templateId, {
        create: [],
        update: [
          {
            id: 'line-1',
            name: 'Loyer modifié',
            amount: 1300,
            kind: 'expense',
            recurrence: 'fixed',
            description: 'Monthly rent payment',
          },
        ],
        delete: [],
        propagateToBudgets: false,
      });
    });

    it('should handle delete operation successfully', async () => {
      // Remove line by its ID
      const lineToDelete = store.lines()[1];
      store.removeTransaction(lineToDelete.id);

      // Mock API response
      const mockApiResponse = {
        data: {
          created: [],
          updated: [],
          deleted: ['line-2'],
        },
      };

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of(mockApiResponse),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(0);
      expect(result.deletedIds).toEqual(['line-2']);

      // Verify API was called with correct data
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).toHaveBeenCalledWith(templateId, {
        create: [],
        update: [],
        delete: ['line-2'],
        propagateToBudgets: false,
      });
    });

    it('should handle mixed operations successfully', async () => {
      // Add new line
      store.addTransaction({
        description: 'Transport',
        amount: 200,
        type: 'expense',
      });

      // Update existing line by its ID
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, { amount: 1400 });

      // Remove existing line by its ID
      const lineToRemove = store.lines()[1];
      store.removeTransaction(lineToRemove.id);

      // Mock API response
      const mockApiResponse = {
        data: {
          created: [
            {
              id: 'new-line-1',
              templateId,
              name: 'Transport',
              amount: 200,
              kind: 'expense' as TransactionKind,
              recurrence: 'fixed',
              description: '',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          updated: [
            {
              id: 'line-1',
              templateId,
              name: 'Loyer',
              amount: 1400,
              kind: 'expense' as TransactionKind,
              recurrence: 'fixed',
              description: 'Monthly rent payment',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          deleted: ['line-2'],
        },
      };

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of(mockApiResponse),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(2);
      expect(store.hasUnsavedChanges()).toBe(false);

      // Verify API was called with correct operations
      const call =
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mock.calls[0];
      expect(call[1].create).toHaveLength(1);
      expect(call[1].update).toHaveLength(1);
      expect(call[1].delete).toEqual(['line-2']);
    });
  });

  describe('API Integration - Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, { amount: 1500 });

      const networkError = new Error('Network request failed');
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => networkError),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network request failed');
      expect(store.error()).toBe('Network request failed');
      expect(store.isLoading()).toBe(false);
      expect(store.hasUnsavedChanges()).toBe(true); // Changes should remain
    });

    it('should handle API validation errors', async () => {
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, { amount: 1500 });

      const validationError = new Error('Invalid data provided');
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => validationError),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid data provided');
      expect(store.error()).toBe('Invalid data provided');
    });

    it('should handle unknown error types', async () => {
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, { amount: 1500 });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => 'String error'),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Une erreur est survenue lors de la sauvegarde',
      );
      expect(store.error()).toBe(
        'Une erreur est survenue lors de la sauvegarde',
      );
    });

    it('should maintain loading state correctly during API calls', async () => {
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, { amount: 1500 });

      // Mock successful response
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: { created: [], updated: [], deleted: [] },
        }),
      );

      expect(store.isLoading()).toBe(false);

      const savePromise = store.saveChanges(templateId, false);

      // Should be loading now (synchronous check after calling saveChanges)
      expect(store.isLoading()).toBe(true);

      const result = await savePromise;

      expect(result.success).toBe(true);
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('API Integration - Edge Cases', () => {
    it('should handle empty operations gracefully', async () => {
      // No changes made
      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toEqual([]);
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).not.toHaveBeenCalled();
    });

    it('should handle API response with missing data', async () => {
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, { amount: 1500 });

      // Mock API response with minimal data
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [],
            updated: [],
            deleted: [],
          },
        }),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toEqual([]);
    });

    it('should properly reset state after successful save', async () => {
      // Make multiple changes
      store.addTransaction({
        description: 'New',
        amount: 100,
        type: 'expense',
      });
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, { amount: 1500 });

      expect(store.hasUnsavedChanges()).toBe(true);

      // Mock successful response
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [
              {
                id: 'new-1',
                name: 'New',
                amount: 100,
                kind: 'expense',
                recurrence: 'fixed',
                description: '',
                templateId,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            updated: [
              {
                id: 'line-1',
                name: 'Loyer',
                amount: 1500,
                kind: 'expense',
                recurrence: 'fixed',
                description: 'Monthly rent payment',
                templateId,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            deleted: [],
          },
        }),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(store.hasUnsavedChanges()).toBe(false);
      expect(store.error()).toBe(null);
      expect(store.isLoading()).toBe(false);

      // Verify state was updated correctly
      const lines = store.activeLines();
      expect(lines).toHaveLength(3); // 2 original + 1 created
      expect(lines[0].isModified).toBe(false);
      expect(lines[1].isModified).toBe(false);
      expect(lines[2].isModified).toBe(false);
    });
  });

  describe('API Integration - Concurrent Operations', () => {
    it('should handle rapid successive changes correctly', async () => {
      // Make rapid changes to the same line
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, { amount: 1300 });
      store.updateTransaction(lineToUpdate.id, { amount: 1400 });
      store.updateTransaction(lineToUpdate.id, {
        description: 'Final description',
      });

      // Mock API response
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [],
            updated: [
              {
                id: 'line-1',
                templateId,
                name: 'Final description',
                amount: 1400,
                kind: 'expense' as TransactionKind,
                recurrence: 'fixed',
                description: 'Monthly rent payment',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            deleted: [],
          },
        }),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);

      // Should only send the final state
      const updateCall =
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mock.calls[0][1];
      expect(updateCall.update).toHaveLength(1);
      expect(updateCall.update[0].name).toBe('Final description');
      expect(updateCall.update[0].amount).toBe(1400);
    });

    it('should handle index changes after line removals correctly', async () => {
      // Add a new line (will be at index 2)
      const newId = store.addTransaction({
        description: 'New Line',
        amount: 100,
        type: 'expense',
      });

      // Remove first line by its ID
      const firstLine = store.lines()[0];
      store.removeTransaction(firstLine.id);

      // Update the new line (should still work after removal)
      store.updateTransaction(newId, { description: 'Updated New Line' });

      // Mock API response
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [
              {
                id: 'new-line-1',
                templateId,
                name: 'Updated New Line',
                amount: 100,
                kind: 'expense' as TransactionKind,
                recurrence: 'fixed',
                description: '',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            updated: [],
            deleted: ['line-1'],
          },
        }),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(1);
      expect(result.updatedLines![0].name).toBe('Updated New Line');
      expect(result.deletedIds).toEqual(['line-1']);

      // Verify final state
      const activeLines = store.activeLines();
      expect(activeLines).toHaveLength(2); // Original line 2 + new line
      expect(activeLines[1].formData.description).toBe('Updated New Line');
    });
  });

  describe('State Synchronization After Save', () => {
    it('should correctly update line references after create operations', async () => {
      store.addTransaction({
        description: 'Transport',
        amount: 150,
        type: 'expense',
      });

      const mockApiResponse = {
        data: {
          created: [
            {
              id: 'new-line-1',
              templateId,
              name: 'Transport',
              amount: 150,
              kind: 'expense' as TransactionKind,
              recurrence: 'fixed',
              description: '',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          updated: [],
          deleted: [],
        },
      };

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of(mockApiResponse),
      );

      await store.saveChanges(templateId, false);

      // Check that new line now has correct original line reference
      const lines = store.lines();
      const newLine = lines[2]; // Was added as third line
      expect(newLine.originalLine).toBeDefined();
      expect(newLine.originalLine!.id).toBe('new-line-1');
      expect(newLine.isModified).toBe(false);
    });

    it('should correctly sync updated lines with server data', async () => {
      const lineToUpdate = store.lines()[0];
      store.updateTransaction(lineToUpdate.id, {
        description: 'Updated Rent',
        amount: 1300,
      });

      const mockApiResponse = {
        data: {
          created: [],
          updated: [
            {
              id: 'line-1',
              templateId,
              name: 'Updated Rent',
              amount: 1300,
              kind: 'expense' as TransactionKind,
              recurrence: 'fixed',
              description: 'Monthly rent payment',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          deleted: [],
        },
      };

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of(mockApiResponse),
      );

      await store.saveChanges(templateId, false);

      // Check that line was synced with server data
      const lines = store.lines();
      const updatedLine = lines[0];
      expect(updatedLine.formData.description).toBe('Updated Rent');
      expect(updatedLine.formData.amount).toBe(1300);
      expect(updatedLine.isModified).toBe(false);
      expect(updatedLine.originalLine!.name).toBe('Updated Rent');
      expect(updatedLine.originalLine!.amount).toBe(1300);
    });
  });
});
