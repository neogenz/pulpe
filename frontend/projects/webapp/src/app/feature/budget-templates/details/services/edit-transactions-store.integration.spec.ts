import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EditTransactionsStore } from './edit-transactions-store';
import { BudgetTemplatesApi } from '../../services/budget-templates-api';
import {
  TransactionFormService,
  type TransactionFormData,
} from '../../services/transaction-form';
import { type TransactionKind, type TemplateLine } from '@pulpe/shared';

describe('EditTransactionsStore - Integration Tests', () => {
  let state: EditTransactionsStore;
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
        EditTransactionsStore,
        { provide: BudgetTemplatesApi, useValue: mockBudgetTemplatesApi },
        { provide: TransactionFormService, useValue: {} },
      ],
    });

    state = TestBed.inject(EditTransactionsStore);
    state.initialize(mockTemplateLines, mockTransactionData);
  });

  describe('API Integration - Successful Operations', () => {
    it('should handle create operation successfully', async () => {
      const newTransaction = {
        description: 'Transport',
        amount: 150,
        type: 'expense' as const,
      };

      // Add new transaction
      state.addTransaction(newTransaction);

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

      const result = await state.saveChanges(templateId);

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
      });
    });

    it('should handle update operation successfully', async () => {
      const transactions = state.activeTransactions();
      const firstTransactionId = transactions[0].id;

      // Update existing transaction
      state.updateTransaction(firstTransactionId, {
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

      const result = await state.saveChanges(templateId);

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
      });
    });

    it('should handle delete operation successfully', async () => {
      const transactions = state.activeTransactions();
      const secondTransactionId = transactions[1].id;

      // Remove transaction
      state.removeTransaction(secondTransactionId);

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

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(0);

      // Verify API was called with correct data
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).toHaveBeenCalledWith(templateId, {
        create: [],
        update: [],
        delete: ['line-2'],
      });
    });

    it('should handle mixed operations successfully', async () => {
      // Add new transaction
      state.addTransaction({
        description: 'Transport',
        amount: 200,
        type: 'expense',
      });

      // Update existing transaction
      const transactions = state.activeTransactions();
      const firstTransactionId = transactions[0].id;
      state.updateTransaction(firstTransactionId, { amount: 1400 });

      // Remove existing transaction
      const secondTransactionId = transactions[1].id;
      state.removeTransaction(secondTransactionId);

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

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(2);
      expect(state.hasUnsavedChanges()).toBe(false);

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
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

      const networkError = new Error('Network request failed');
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => networkError),
      );

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network request failed');
      expect(state.error()).toBe('Network request failed');
      expect(state.isLoading()).toBe(false);
      expect(state.hasUnsavedChanges()).toBe(true); // Changes should remain
    });

    it('should handle API validation errors', async () => {
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

      const validationError = new Error('Invalid data provided');
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => validationError),
      );

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid data provided');
      expect(state.error()).toBe('Invalid data provided');
    });

    it('should handle unknown error types', async () => {
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => 'String error'),
      );

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Une erreur est survenue lors de la sauvegarde',
      );
      expect(state.error()).toBe(
        'Une erreur est survenue lors de la sauvegarde',
      );
    });

    it('should maintain loading state correctly during API calls', async () => {
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

      // Mock successful response
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: { created: [], updated: [], deleted: [] },
        }),
      );

      expect(state.isLoading()).toBe(false);

      const savePromise = state.saveChanges(templateId);

      // Should be loading now (synchronous check after calling saveChanges)
      expect(state.isLoading()).toBe(true);

      const result = await savePromise;

      expect(result.success).toBe(true);
      expect(state.isLoading()).toBe(false);
    });
  });

  describe('API Integration - Edge Cases', () => {
    it('should handle empty operations gracefully', async () => {
      // No changes made
      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toEqual([]);
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).not.toHaveBeenCalled();
    });

    it('should handle API response with missing data', async () => {
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

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

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toEqual([]);
    });

    it('should properly reset state after successful save', async () => {
      // Make multiple changes
      state.addTransaction({
        description: 'New',
        amount: 100,
        type: 'expense',
      });
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

      expect(state.hasUnsavedChanges()).toBe(true);

      // Mock successful response
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [{ id: 'new-1', name: 'New' }],
            updated: [{ id: 'line-1', name: 'Loyer', amount: 1500 }],
            deleted: [],
          },
        }),
      );

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(true);
      expect(state.hasUnsavedChanges()).toBe(false);
      expect(state.error()).toBe(null);
      expect(state.isLoading()).toBe(false);
    });
  });

  describe('API Integration - Concurrent Operations', () => {
    it('should handle rapid successive changes correctly', async () => {
      const transactions = state.activeTransactions();
      const firstId = transactions[0].id;

      // Make rapid changes
      state.updateTransaction(firstId, { amount: 1300 });
      state.updateTransaction(firstId, { amount: 1400 });
      state.updateTransaction(firstId, { description: 'Final description' });

      // Mock API response
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [],
            updated: [
              {
                id: 'line-1',
                name: 'Final description',
                amount: 1400,
                kind: 'expense',
              },
            ],
            deleted: [],
          },
        }),
      );

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(true);

      // Should only send the final state
      const updateCall =
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mock.calls[0][1];
      expect(updateCall.update).toHaveLength(1);
      expect(updateCall.update[0].name).toBe('Final description');
      expect(updateCall.update[0].amount).toBe(1400);
    });
  });
});
