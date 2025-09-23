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

    it('should add new line and return UUID', () => {
      const newData: TransactionFormData = {
        description: 'Transport',
        amount: 150,
        type: 'expense',
      };

      const id = store.addTransaction(newData);

      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ); // UUID format

      const lines = store.activeLines();
      expect(lines).toHaveLength(3);

      const newLine = lines[2];
      expect(newLine.id).toBe(id);
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

    it('should update existing line by ID and return true', () => {
      const updates = { description: 'Loyer modifié', amount: 1300 };
      const firstLine = store.activeLines()[0];

      const result = store.updateTransaction(firstLine.id, updates);

      expect(result).toBe(true);

      const line = store.activeLines()[0];
      expect(line.formData.description).toBe('Loyer modifié');
      expect(line.formData.amount).toBe(1300);
      expect(line.formData.type).toBe('expense'); // unchanged
      expect(line.isModified).toBe(true);
    });

    it('should return false for invalid ID', () => {
      const result = store.updateTransaction('invalid-uuid', {
        description: 'Test',
      });

      expect(result).toBe(false);
    });

    it('should return false for non-existent UUID', () => {
      const result = store.updateTransaction(
        '12345678-1234-1234-1234-123456789abc',
        {
          description: 'Test',
        },
      );

      expect(result).toBe(false);
    });

    it('should mark as having unsaved changes', () => {
      expect(store.hasUnsavedChanges()).toBe(false);
      const firstLine = store.activeLines()[0];

      store.updateTransaction(firstLine.id, { description: 'Modified' });

      expect(store.hasUnsavedChanges()).toBe(true);
    });

    it('should not update deleted line', () => {
      const firstLine = store.activeLines()[0];
      store.removeTransaction(firstLine.id);

      const result = store.updateTransaction(firstLine.id, {
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
      const firstLine = store.activeLines()[0];
      const result = store.removeTransaction(firstLine.id);

      expect(result).toBe(true);
      expect(store.activeLines().length).toBe(1);
    });

    it('should return false when trying to remove last transaction', () => {
      const lines = store.activeLines();
      // Remove first line
      store.removeTransaction(lines[0].id);
      expect(store.activeLines().length).toBe(1);

      // Try to remove second (last remaining) line
      const remainingLine = store.activeLines()[0];
      const result = store.removeTransaction(remainingLine.id);

      expect(result).toBe(false);
      expect(store.activeLines().length).toBe(1);
    });

    it('should return false for invalid ID', () => {
      const result = store.removeTransaction('invalid-uuid');

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
      const firstLine = store.activeLines()[0];
      store.removeTransaction(firstLine.id);
      expect(store.canRemoveTransaction()).toBe(false);
    });

    it('should preserve hasUnsavedChanges after removal', () => {
      const firstLine = store.activeLines()[0];
      store.removeTransaction(firstLine.id);
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
      const firstLine = store.activeLines()[0];
      store.updateTransaction(firstLine.id, { amount: 1400 });

      // Remove another line
      const secondLine = store.activeLines()[1];
      store.removeTransaction(secondLine.id);

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
            propagation: {
              mode: 'template-only',
              affectedBudgetIds: [],
              affectedBudgetsCount: 0,
            },
          },
        }),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toHaveLength(2);
      expect(result.propagation?.mode).toBe('template-only');
      expect(store.isLoading()).toBe(false);
      expect(store.hasUnsavedChanges()).toBe(false);

      // Verify API was called with correct operations
      const bulkOps: TemplateLinesBulkOperations =
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mock.calls[0][1];
      expect(bulkOps.create).toHaveLength(1);
      expect(bulkOps.update).toHaveLength(1);
      expect(bulkOps.delete).toEqual(['line-2']);
      expect(bulkOps.propagateToBudgets).toBe(false);
    });

    it('should handle save errors gracefully', async () => {
      const firstLine = store.activeLines()[0];
      store.updateTransaction(firstLine.id, { amount: 1500 });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBe('API Error');
      expect(store.hasUnsavedChanges()).toBe(true); // Changes preserved
    });

    it('should forward propagation flag when requested', async () => {
      const firstLine = store.activeLines()[0];
      store.updateTransaction(firstLine.id, { amount: 1500 });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [],
            updated: [],
            deleted: [],
            propagation: {
              mode: 'propagate',
              affectedBudgetIds: ['budget-1'],
              affectedBudgetsCount: 1,
            },
          },
        }),
      );

      await store.saveChanges(templateId, true);

      const bulkOps: TemplateLinesBulkOperations =
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mock.calls[0][1];
      expect(bulkOps.propagateToBudgets).toBe(true);
    });

    it('should set loading state during save', async () => {
      const firstLine = store.activeLines()[0];
      store.updateTransaction(firstLine.id, { amount: 1500 });

      let loadingDuringSave = false;
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockImplementation(
        () => {
          loadingDuringSave = store.isLoading();
          return of({
            data: {
              created: [],
              updated: [],
              deleted: [],
              propagation: {
                mode: 'template-only',
                affectedBudgetIds: [],
                affectedBudgetsCount: 0,
              },
            },
          });
        },
      );

      await store.saveChanges(templateId, false);

      expect(loadingDuringSave).toBe(true);
      expect(store.isLoading()).toBe(false);
    });

    it('should not save when no changes exist', async () => {
      const result = await store.saveChanges(templateId, false);

      expect(result.success).toBe(true);
      expect(result.updatedLines).toEqual([]);
      expect(result.propagation).toBeNull();
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).not.toHaveBeenCalled();
    });

    it('should clear error on loading start', async () => {
      // Set an error first
      store.error.set('Previous error');
      const firstLine = store.activeLines()[0];
      store.updateTransaction(firstLine.id, { amount: 1500 });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        of({
          data: {
            created: [],
            updated: [],
            deleted: [],
            propagation: {
              mode: 'template-only',
              affectedBudgetIds: [],
              affectedBudgetsCount: 0,
            },
          },
        }),
      );

      await store.saveChanges(templateId, false);

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
      const firstLine = store.activeLines()[0];
      store.removeTransaction(firstLine.id);
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
      const firstLine = store.activeLines()[0];
      store.removeTransaction(firstLine.id);
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
      const firstLine = store.activeLines()[0];
      store.updateTransaction(firstLine.id, { amount: 1500 });

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => 'Unknown error type'),
      );

      const result = await store.saveChanges('template-123', false);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Une erreur est survenue lors de la sauvegarde',
      );
    });

    it('should preserve changes on error', async () => {
      const firstLine = store.activeLines()[0];
      store.updateTransaction(firstLine.id, { amount: 1500 });
      expect(store.hasUnsavedChanges()).toBe(true);

      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await store.saveChanges('template-123', false);

      // Changes should still be there for retry
      expect(store.hasUnsavedChanges()).toBe(true);
      expect(store.activeLines()[0].formData.amount).toBe(1500);
    });
  });

  describe('State Consistency', () => {
    it('should maintain state consistency after complex operations', () => {
      store.initialize(mockTemplateLines, mockTransactionData);

      const initialLines = store.activeLines();
      // Add, update, remove in sequence
      const newId = store.addTransaction({
        description: 'New',
        amount: 100,
        type: 'expense',
      });
      store.updateTransaction(initialLines[0].id, { amount: 1500 });
      store.removeTransaction(initialLines[1].id);
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

  describe('UUID-Based Identification (Bug Fix)', () => {
    beforeEach(() => {
      store.initialize(mockTemplateLines, mockTransactionData);
    });

    it('should correctly handle delete → add → edit scenario with stable IDs', () => {
      // Initial state: 2 transactions with stable IDs
      const initialLines = store.activeLines();
      expect(initialLines).toHaveLength(2);
      expect(store.lines()).toHaveLength(2);

      const firstLineId = initialLines[0].id;
      const secondLineId = initialLines[1].id;

      // Step 1: Delete first transaction
      const removeResult = store.removeTransaction(firstLineId);
      expect(removeResult).toBe(true);

      // After deletion: activeLines has 1 item, lines still has 2 (one marked as deleted)
      expect(store.activeLines()).toHaveLength(1);
      expect(store.lines()).toHaveLength(2);

      // Step 2: Add a new transaction
      const newId = store.addTransaction({
        description: 'New Transaction',
        amount: 300,
        type: 'expense',
      });

      // After addition: activeLines has 2 items, lines has 3
      expect(store.activeLines()).toHaveLength(2);
      expect(store.lines()).toHaveLength(3);

      // Step 3: Edit the new transaction using its stable UUID
      const updateResult = store.updateTransaction(newId, {
        description: 'Updated New Transaction',
        amount: 400,
      });
      expect(updateResult).toBe(true);

      // Step 4: Verify only the new transaction was updated
      const activeLines = store.activeLines();
      expect(activeLines).toHaveLength(2);

      // Find lines by ID to verify correct updates
      const remainingOriginalLine = activeLines.find(
        (line) => line.id === secondLineId,
      );
      const newLine = activeLines.find((line) => line.id === newId);

      // Original remaining line should be unchanged
      expect(remainingOriginalLine?.formData.description).toBe('Salaire');
      expect(remainingOriginalLine?.formData.amount).toBe(5000);
      expect(remainingOriginalLine?.isModified).toBe(false);

      // New line should be updated
      expect(newLine?.formData.description).toBe('Updated New Transaction');
      expect(newLine?.formData.amount).toBe(400);
      expect(newLine?.isModified).toBe(true);
    });

    it('should handle complex operations with stable UUID identification', () => {
      const initialLines = store.activeLines();
      const firstLineId = initialLines[0].id;
      const secondLineId = initialLines[1].id;

      // Add some more transactions
      const thirdId = store.addTransaction({
        description: 'Third',
        amount: 100,
        type: 'expense',
      });
      const fourthId = store.addTransaction({
        description: 'Fourth',
        amount: 200,
        type: 'income',
      });

      expect(store.activeLines()).toHaveLength(4);

      // Delete first line (existing - should be marked as deleted)
      store.removeTransaction(firstLineId);

      // Delete third line (new - should be completely removed)
      store.removeTransaction(thirdId);

      // Remaining active lines should be second and fourth
      expect(store.activeLines()).toHaveLength(2);
      const remainingLines = store.activeLines();

      // Verify the correct lines remain by checking their IDs
      const remainingIds = remainingLines.map((line) => line.id);
      expect(remainingIds).toContain(secondLineId);
      expect(remainingIds).toContain(fourthId);
      expect(remainingIds).not.toContain(firstLineId);
      expect(remainingIds).not.toContain(thirdId);

      // Add a new transaction
      const fifthId = store.addTransaction({
        description: 'Fifth',
        amount: 500,
        type: 'saving',
      });

      // Update specific lines by ID - this should work reliably
      store.updateTransaction(secondLineId, { amount: 6000 });
      store.updateTransaction(fifthId, { amount: 600 });

      const finalLines = store.activeLines();
      expect(finalLines).toHaveLength(3);

      // Find and verify updates by ID
      const updatedSecondLine = finalLines.find(
        (line) => line.id === secondLineId,
      );
      const unchangedFourthLine = finalLines.find(
        (line) => line.id === fourthId,
      );
      const updatedFifthLine = finalLines.find((line) => line.id === fifthId);

      expect(updatedSecondLine?.formData.amount).toBe(6000);
      expect(unchangedFourthLine?.formData.amount).toBe(200);
      expect(updatedFifthLine?.formData.amount).toBe(600);
    });

    it('should ensure all lines have stable UUIDs', () => {
      const initialLines = store.activeLines();

      // Check that existing lines use their original IDs
      expect(initialLines[0].id).toBe(mockTemplateLines[0].id);
      expect(initialLines[1].id).toBe(mockTemplateLines[1].id);

      // Check that new lines get UUIDs
      const newId = store.addTransaction({
        description: 'New',
        amount: 100,
        type: 'expense',
      });

      expect(newId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      const newLine = store.activeLines().find((line) => line.id === newId);
      expect(newLine?.id).toBe(newId);
      expect(newLine?.originalLine).toBeUndefined();
    });
  });
});
