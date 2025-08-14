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
import {
  type TransactionKind,
  type TemplateLine,
  type TemplateLinesBulkOperations,
} from '@pulpe/shared';

describe('TemplateLineStore - Unit Tests', () => {
  let store: TemplateLineStore;
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
      kind: 'expense' as TransactionKind,
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
      kind: 'income' as TransactionKind,
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
        TemplateLineStore,
        { provide: BudgetTemplatesApi, useValue: mockBudgetTemplatesApi },
        {
          provide: TransactionFormService,
          useValue: mockTransactionFormService,
        },
      ],
    });

    store = TestBed.inject(TemplateLineStore);
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      expect(store.lines()).toEqual([]);
      expect(store.activeLines()).toEqual([]);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBe(null);
      expect(store.hasUnsavedChanges()).toBe(false);
      expect(store.canRemoveTransaction()).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize lines from template lines and form data', () => {
      store.initialize(mockTemplateLines, mockTransactionData);

      const lines = store.activeLines();
      expect(lines).toHaveLength(2);

      expect(lines[0].formData).toEqual(mockTransactionData[0]);
      expect(lines[0].isModified).toBe(false);
      expect(lines[0].originalLine).toEqual(mockTemplateLines[0]);

      expect(lines[1].formData).toEqual(mockTransactionData[1]);
      expect(lines[1].isModified).toBe(false);
      expect(lines[1].originalLine).toEqual(mockTemplateLines[1]);
    });

    it('should handle mismatched lengths gracefully', () => {
      const shortFormData = [mockTransactionData[0]];

      store.initialize(mockTemplateLines, shortFormData);

      const lines = store.activeLines();
      expect(lines).toHaveLength(1);
      expect(lines[0].formData).toEqual(shortFormData[0]);
    });

    it('should clear error state on initialization', () => {
      store.error.set('Previous error');

      store.initialize(mockTemplateLines, mockTransactionData);

      expect(store.error()).toBe(null);
    });
  });

  describe('Add Transaction', () => {
    beforeEach(() => {
      store.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should add new line and return index as string ID', () => {
      const newData: TransactionFormData = {
        description: 'Transport',
        amount: 150,
        type: 'expense',
      };

      const id = store.addTransaction(newData);

      expect(id).toBe('2'); // Index as string

      const lines = store.activeLines();
      expect(lines).toHaveLength(3);

      const newLine = lines[2];
      expect(newLine.formData).toEqual(newData);
      expect(newLine.isModified).toBe(true);
      expect(newLine.originalLine).toBeUndefined();
    });

    it('should update line count', () => {
      expect(store.activeLines().length).toBe(2);

      store.addTransaction({
        description: 'Test',
        amount: 100,
        type: 'expense',
      });

      expect(store.activeLines().length).toBe(3);
    });

    it('should mark as having unsaved changes', () => {
      expect(store.hasUnsavedChanges()).toBe(false);

      store.addTransaction({
        description: 'Test',
        amount: 100,
        type: 'expense',
      });

      expect(store.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('Update Transaction', () => {
    beforeEach(() => {
      store.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should update existing line by index and return true', () => {
      const updates = { description: 'Loyer modifié', amount: 1300 };

      const result = store.updateTransaction('0', updates);

      expect(result).toBe(true);

      const line = store.activeLines()[0];
      expect(line.formData.description).toBe('Loyer modifié');
      expect(line.formData.amount).toBe(1300);
      expect(line.formData.type).toBe('expense'); // unchanged
      expect(line.isModified).toBe(true);
    });

    it('should return false for invalid index', () => {
      const result = store.updateTransaction('99', {
        description: 'Test',
      });

      expect(result).toBe(false);
    });

    it('should return false for non-numeric ID', () => {
      const result = store.updateTransaction('invalid', {
        description: 'Test',
      });

      expect(result).toBe(false);
    });

    it('should mark as having unsaved changes', () => {
      expect(store.hasUnsavedChanges()).toBe(false);

      store.updateTransaction('0', { description: 'Modified' });

      expect(store.hasUnsavedChanges()).toBe(true);
    });

    it('should not update deleted line', () => {
      store.removeTransaction('0');

      const result = store.updateTransaction('0', {
        description: 'Test',
      });

      expect(result).toBe(false);
    });
  });

  describe('Remove Transaction', () => {
    beforeEach(() => {
      store.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should remove existing line and return true', () => {
      const result = store.removeTransaction('0');

      expect(result).toBe(true);
      expect(store.activeLines().length).toBe(1);
    });

    it('should return false when trying to remove last transaction', () => {
      // Remove first line
      store.removeTransaction('0');
      expect(store.activeLines().length).toBe(1);

      // Try to remove second (last remaining) line
      const result = store.removeTransaction('1');

      expect(result).toBe(false);
      expect(store.activeLines().length).toBe(1);
    });

    it('should return false for invalid index', () => {
      const result = store.removeTransaction('99');

      expect(result).toBe(false);
    });

    it('should handle new line removal completely', () => {
      const newId = store.addTransaction({
        description: 'New',
        amount: 100,
        type: 'expense',
      });

      expect(store.lines().length).toBe(3);

      const result = store.removeTransaction(newId);

      expect(result).toBe(true);
      expect(store.lines().length).toBe(2); // Completely removed
      expect(store.activeLines().length).toBe(2);
    });

    it('should update canRemoveTransaction signal', () => {
      expect(store.canRemoveTransaction()).toBe(true);

      // Remove one line, should still be able to remove
      store.removeTransaction('0');
      expect(store.canRemoveTransaction()).toBe(false);
    });

    it('should preserve hasUnsavedChanges after removal', () => {
      store.removeTransaction('0');
      expect(store.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('Save Changes', () => {
    const templateId = 'template-123';

    beforeEach(() => {
      store.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should save changes successfully with mixed operations', async () => {
      // Add a new line
      store.addTransaction({
        description: 'New Transaction',
        amount: 200,
        type: 'expense',
      });

      // Update existing line
      store.updateTransaction('0', { amount: 1400 });

      // Remove another line
      store.removeTransaction('1');

      // Mock API response
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [
              {
                id: 'new-line-1',
                name: 'New Transaction',
                amount: 200,
                kind: 'expense',
                recurrence: 'fixed',
                description: '',
                templateId: 'template-1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            updated: [
              {
                id: 'line-1',
                name: 'Loyer',
                amount: 1400,
                kind: 'expense',
                recurrence: 'fixed',
                description: '',
                templateId: 'template-1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            deleted: ['line-2'],
          },
        }),
      );

      const result = await store.saveChanges(templateId);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(2);
      expect(store.isLoading()).toBe(false);
      expect(store.hasUnsavedChanges()).toBe(false);

      // Verify API was called with correct operations
      const bulkOps: TemplateLinesBulkOperations =
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mock.calls[0][1];
      expect(bulkOps.create).toHaveLength(1);
      expect(bulkOps.update).toHaveLength(1);
      expect(bulkOps.delete).toEqual(['line-2']);
    });

    it('should handle save errors gracefully', async () => {
      store.updateTransaction('0', { amount: 1500 });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      const result = await store.saveChanges(templateId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBe('API Error');
      expect(store.hasUnsavedChanges()).toBe(true); // Changes preserved
    });

    it('should set loading state during save', async () => {
      store.updateTransaction('0', { amount: 1500 });

      let loadingDuringSave = false;
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockImplementation(
        () => {
          loadingDuringSave = store.isLoading();
          return of({ data: { created: [], updated: [], deleted: [] } });
        },
      );

      await store.saveChanges(templateId);

      expect(loadingDuringSave).toBe(true);
      expect(store.isLoading()).toBe(false);
    });

    it('should not save when no changes exist', async () => {
      const result = await store.saveChanges(templateId);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toEqual([]);
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).not.toHaveBeenCalled();
    });

    it('should clear error on loading start', async () => {
      // Set an error first
      store.error.set('Previous error');
      store.updateTransaction('0', { amount: 1500 });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({ data: { created: [], updated: [], deleted: [] } }),
      );

      await store.saveChanges(templateId);

      expect(store.error()).toBe(null);
    });
  });

  describe('Computed Signals', () => {
    beforeEach(() => {
      store.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should calculate active line count correctly', () => {
      expect(store.activeLines().length).toBe(2);

      // Add line
      store.addTransaction({
        description: 'Test',
        amount: 100,
        type: 'expense',
      });
      expect(store.activeLines().length).toBe(3);

      // Remove line (mark as deleted)
      store.removeTransaction('0');
      expect(store.activeLines().length).toBe(2);
    });

    it('should detect unsaved changes correctly', () => {
      expect(store.hasUnsavedChanges()).toBe(false);

      // Add line
      store.addTransaction({
        description: 'Test',
        amount: 100,
        type: 'expense',
      });
      expect(store.hasUnsavedChanges()).toBe(true);
    });

    it('should determine canRemoveTransaction correctly', () => {
      expect(store.canRemoveTransaction()).toBe(true);

      // Remove one line
      store.removeTransaction('0');
      expect(store.canRemoveTransaction()).toBe(false);
    });

    it('should validate lines correctly', () => {
      expect(store.isValid()).toBe(true);

      // Add invalid line
      store.addTransaction({
        description: '',
        amount: -100,
        type: 'expense',
      });

      expect(store.isValid()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      store.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should handle unknown errors with fallback message', async () => {
      store.updateTransaction('0', { amount: 1500 });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => 'Unknown error type'),
      );

      const result = await store.saveChanges('template-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Une erreur est survenue lors de la sauvegarde',
      );
    });

    it('should preserve changes on error', async () => {
      store.updateTransaction('0', { amount: 1500 });
      expect(store.hasUnsavedChanges()).toBe(true);

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await store.saveChanges('template-123');

      // Changes should still be there for retry
      expect(store.hasUnsavedChanges()).toBe(true);
      expect(store.activeLines()[0].formData.amount).toBe(1500);
    });
  });

  describe('State Consistency', () => {
    it('should maintain state consistency after complex operations', () => {
      store.initialize(mockTemplateLines, mockTransactionData);

      // Add, update, remove in sequence
      const newId = store.addTransaction({
        description: 'New',
        amount: 100,
        type: 'expense',
      });
      store.updateTransaction('0', { amount: 1500 });
      store.removeTransaction('1');
      store.updateTransaction(newId, { description: 'Updated New' });

      const activeLines = store.activeLines();
      expect(activeLines).toHaveLength(2);

      // Check first line is updated
      expect(activeLines[0].formData.amount).toBe(1500);
      expect(activeLines[0].isModified).toBe(true);

      // Check new line is present and updated
      expect(activeLines[1].formData.description).toBe('Updated New');
      expect(activeLines[1].isModified).toBe(true);
      expect(activeLines[1].originalLine).toBeUndefined();
    });
  });
});
