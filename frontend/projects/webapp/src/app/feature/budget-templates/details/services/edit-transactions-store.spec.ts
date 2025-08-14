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
import {
  TemplateLineKind,
  type TemplateLine,
  type TemplateLinesBulkOperations,
} from '@pulpe/shared';

describe('EditTransactionsStore - Unit Tests', () => {
  let state: EditTransactionsStore;
  let mockBudgetTemplatesApi: {
    bulkOperationsTemplateLines$: ReturnType<typeof vi.fn>;
  };
  let mockTransactionFormService: {
    createTransactionFormGroup: ReturnType<typeof vi.fn>;
    validateTransactionsForm: ReturnType<typeof vi.fn>;
  };

  const mockTemplateLines: TemplateLine[] = [
    {
      id: 'line-1',
      templateId: 'template-1',
      name: 'Loyer',
      amount: 1200,
      kind: 'expense' as TemplateLineKind,
      recurrence: 'fixed',
      description: '',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'line-2',
      templateId: 'template-1',
      name: 'Salaire',
      amount: 5000,
      kind: 'income' as TemplateLineKind,
      recurrence: 'fixed',
      description: '',
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

    mockTransactionFormService = {
      createTransactionFormGroup: vi.fn(),
      validateTransactionsForm: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        EditTransactionsStore,
        { provide: BudgetTemplatesApi, useValue: mockBudgetTemplatesApi },
        {
          provide: TransactionFormService,
          useValue: mockTransactionFormService,
        },
      ],
    });

    state = TestBed.inject(EditTransactionsStore);
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      expect(state.activeTransactions()).toEqual([]);
      expect(state.isLoading()).toBe(false);
      expect(state.error()).toBe(null);
      expect(state.activeTransactions().length).toBe(0);
      expect(state.hasUnsavedChanges()).toBe(false);
      expect(state.canRemoveTransaction()).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize transactions from template lines and form data', () => {
      state.initialize(mockTemplateLines, mockTransactionData);

      const transactions = state.activeTransactions();
      expect(transactions).toHaveLength(2);

      expect(transactions[0].formData).toEqual(mockTransactionData[0]);
      expect(transactions[0].isNew).toBe(false);
      expect(transactions[0].isDeleted).toBe(false);
      expect(transactions[0].originalLine).toEqual(mockTemplateLines[0]);

      expect(transactions[1].formData).toEqual(mockTransactionData[1]);
      expect(transactions[1].isNew).toBe(false);
      expect(transactions[1].isDeleted).toBe(false);
      expect(transactions[1].originalLine).toEqual(mockTemplateLines[1]);
    });

    it('should handle mismatched lengths gracefully', () => {
      const shortFormData = [mockTransactionData[0]];

      state.initialize(mockTemplateLines, shortFormData);

      const transactions = state.activeTransactions();
      expect(transactions).toHaveLength(1);
      expect(transactions[0].formData).toEqual(shortFormData[0]);
    });
  });

  describe('Add Transaction', () => {
    beforeEach(() => {
      state.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should add new transaction and return unique ID', () => {
      const newData: TransactionFormData = {
        description: 'Transport',
        amount: 150,
        type: 'expense',
      };

      const id = state.addTransaction(newData);

      expect(id).toBeTruthy();
      expect(id.startsWith('temp-')).toBe(true);

      const transactions = state.activeTransactions();
      expect(transactions).toHaveLength(3);

      const newTransaction = transactions.find((t) => t.id === id);
      expect(newTransaction).toBeDefined();
      expect(newTransaction!.formData).toEqual(newData);
      expect(newTransaction!.isNew).toBe(true);
      expect(newTransaction!.isDeleted).toBe(false);
      expect(newTransaction!.originalLine).toBeUndefined();
    });

    it('should update transaction count', () => {
      expect(state.activeTransactions().length).toBe(2);

      state.addTransaction({
        description: 'Test',
        amount: 100,
        type: 'expense',
      });

      expect(state.activeTransactions().length).toBe(3);
    });

    it('should mark as having unsaved changes', () => {
      expect(state.hasUnsavedChanges()).toBe(false);

      state.addTransaction({
        description: 'Test',
        amount: 100,
        type: 'expense',
      });

      expect(state.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('Update Transaction', () => {
    let transactionId: string;

    beforeEach(() => {
      state.initialize(mockTemplateLines, mockTransactionData);
      const transactions = state.activeTransactions();
      transactionId = transactions[0].id;
    });

    it('should update existing transaction and return true', () => {
      const updates = { description: 'Loyer modifié', amount: 1300 };

      const result = state.updateTransaction(transactionId, updates);

      expect(result).toBe(true);

      const transaction = state
        .activeTransactions()
        .find((t) => t.id === transactionId);
      expect(transaction!.formData.description).toBe('Loyer modifié');
      expect(transaction!.formData.amount).toBe(1300);
      expect(transaction!.formData.type).toBe('expense'); // unchanged
    });

    it('should return false for non-existent transaction', () => {
      const result = state.updateTransaction('non-existent', {
        description: 'Test',
      });

      expect(result).toBe(false);
    });

    it('should mark as having unsaved changes', () => {
      expect(state.hasUnsavedChanges()).toBe(false);

      state.updateTransaction(transactionId, { description: 'Modified' });

      expect(state.hasUnsavedChanges()).toBe(true);
    });

    it('should not update deleted transaction', () => {
      state.removeTransaction(transactionId);
      expect(state.hasUnsavedChanges()).toBe(true);

      const result = state.updateTransaction(transactionId, {
        description: 'Test',
      });

      expect(result).toBe(false);
      // Should still have unsaved changes from the removal
      expect(state.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('Remove Transaction', () => {
    beforeEach(() => {
      state.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should mark transaction as deleted and return true', () => {
      const transactions = state.activeTransactions();
      const transactionId = transactions[0].id;

      const result = state.removeTransaction(transactionId);

      expect(result).toBe(true);
      expect(state.activeTransactions().length).toBe(1); // Only non-deleted count

      // Transaction should be marked as deleted (not in activeTransactions anymore)
      const activeTransaction = state
        .activeTransactions()
        .find((t) => t.id === transactionId);
      expect(activeTransaction).toBeUndefined(); // Should not be in active transactions
    });

    it('should return false when trying to remove last transaction', () => {
      // Remove first transaction
      const transactions = state.activeTransactions();
      state.removeTransaction(transactions[0].id);

      // Try to remove second (last remaining) transaction
      const result = state.removeTransaction(transactions[1].id);

      expect(result).toBe(false);
      expect(state.activeTransactions().length).toBe(1);
    });

    it('should return false for non-existent transaction', () => {
      const result = state.removeTransaction('non-existent');

      expect(result).toBe(false);
    });

    it('should handle new transaction removal', () => {
      const newId = state.addTransaction({
        description: 'New',
        amount: 100,
        type: 'expense',
      });

      const result = state.removeTransaction(newId);

      expect(result).toBe(true);
      expect(
        state.activeTransactions().find((t) => t.id === newId),
      ).toBeUndefined();
    });

    it('should update canRemoveTransaction signal', () => {
      expect(state.canRemoveTransaction()).toBe(true);

      // Remove one transaction, should still be able to remove
      const transactions = state.activeTransactions();
      state.removeTransaction(transactions[0].id);
      expect(state.canRemoveTransaction()).toBe(false);
    });
  });

  describe('Save Changes', () => {
    const templateId = 'template-123';

    beforeEach(() => {
      state.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should save changes successfully with mixed operations', async () => {
      // Add a new transaction
      state.addTransaction({
        description: 'New Transaction',
        amount: 200,
        type: 'expense',
      });

      // Update existing transaction
      const transactions = state.activeTransactions();
      const existingId = transactions[0].id;
      state.updateTransaction(existingId, { amount: 1400 });

      // Remove another transaction
      const toRemoveId = transactions[1].id;
      state.removeTransaction(toRemoveId);

      // Mock API response
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [{ id: 'new-line-1', name: 'New Transaction' }],
            updated: [{ id: 'line-1', name: 'Loyer', amount: 1400 }],
            deleted: ['line-2'],
          },
        }),
      );

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(2);
      expect(state.isLoading()).toBe(false);
      expect(state.hasUnsavedChanges()).toBe(false);

      // Verify API was called with correct operations
      const bulkOps: TemplateLinesBulkOperations =
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mock.calls[0][1];
      expect(bulkOps.create).toHaveLength(1);
      expect(bulkOps.update).toHaveLength(1);
      expect(bulkOps.delete).toEqual(['line-2']);
    });

    it('should handle save errors gracefully', async () => {
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(state.isLoading()).toBe(false);
      expect(state.error()).toBe('API Error');
    });

    it('should set loading state during save', async () => {
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

      let loadingDuringSave = false;
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockImplementation(
        () => {
          loadingDuringSave = state.isLoading();
          return of({ data: { created: [], updated: [], deleted: [] } });
        },
      );

      await state.saveChanges(templateId);

      expect(loadingDuringSave).toBe(true);
      expect(state.isLoading()).toBe(false);
    });

    it('should not save when no changes exist', async () => {
      const result = await state.saveChanges(templateId);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toEqual([]);
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Computed Signals', () => {
    beforeEach(() => {
      state.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should calculate transaction count correctly', () => {
      expect(state.activeTransactions().length).toBe(2);

      // Add transaction
      state.addTransaction({
        description: 'Test',
        amount: 100,
        type: 'expense',
      });
      expect(state.activeTransactions().length).toBe(3);

      // Remove transaction (mark as deleted)
      const transactions = state.activeTransactions();
      state.removeTransaction(transactions[0].id);
      expect(state.activeTransactions().length).toBe(2);
    });

    it('should detect unsaved changes correctly', () => {
      expect(state.hasUnsavedChanges()).toBe(false);

      // Add transaction
      state.addTransaction({
        description: 'Test',
        amount: 100,
        type: 'expense',
      });
      expect(state.hasUnsavedChanges()).toBe(true);
    });

    it('should determine canRemoveTransaction correctly', () => {
      expect(state.canRemoveTransaction()).toBe(true);

      // Remove one transaction
      const transactions = state.activeTransactions();
      state.removeTransaction(transactions[0].id);
      expect(state.canRemoveTransaction()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      state.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should clear error state', async () => {
      // Trigger an error first through a failed save
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('Test error')),
      );

      // Make a change and try to save to trigger error
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

      await state.saveChanges('template-123');
      expect(state.error()).toBe('Test error');

      // Mock successful response for next save
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({ data: { created: [], updated: [], deleted: [] } }),
      );

      // Error clearing happens automatically during successful operations
      await state.saveChanges('template-123'); // This should clear the error
      expect(state.error()).toBe(null);
    });

    it('should handle unknown errors with fallback message', async () => {
      state.updateTransaction(state.activeTransactions()[0].id, {
        amount: 1500,
      });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => 'Unknown error type'),
      );

      const result = await state.saveChanges('template-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Une erreur est survenue lors de la sauvegarde',
      );
    });
  });
});
