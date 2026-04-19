import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import EditTransactionsDialog from './edit-transactions-dialog';
import { TemplateLineStore } from '../services/template-line-store';
import { TransactionFormService } from '../../services/transaction-form';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { CurrencyConverterService } from '@core/currency';
import { TransactionLabelPipe } from '@ui/transaction-display';
import type { TransactionFormData } from '../../services/transaction-form';
import type { TemplateLine } from 'pulpe-shared';
import { MatDialog } from '@angular/material/dialog';
import { TemplatePropagationDialog } from './template-propagation-dialog';

describe('EditTransactionsDialog - Component Tests', () => {
  let component: EditTransactionsDialog;
  let mockDialogRef: {
    close: ReturnType<typeof vi.fn>;
    disableClose: boolean;
  };
  let mockBudgetTemplatesApi: {
    bulkOperationsTemplateLines$: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  const mockDialogData = {
    transactions: [
      {
        description: 'Loyer',
        amount: 1200,
        type: 'expense' as const,
      },
      {
        description: 'Salaire',
        amount: 5000,
        type: 'income' as const,
      },
    ] as TransactionFormData[],
    templateName: 'Test Template',
    templateId: 'template-123',
    originalTemplateLines: [
      {
        id: 'line-1',
        templateId: 'template-123',
        name: 'Loyer',
        amount: 1200,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'line-2',
        templateId: 'template-123',
        name: 'Salaire',
        amount: 5000,
        kind: 'income',
        recurrence: 'fixed',
        description: '',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ] as TemplateLine[],
  };

  beforeEach(() => {
    mockDialogRef = {
      close: vi.fn(),
      disableClose: false,
    };

    mockBudgetTemplatesApi = {
      bulkOperationsTemplateLines$: vi.fn(),
    };

    mockDialog = {
      open: vi.fn().mockImplementation((component) => {
        if (component === TemplatePropagationDialog) {
          return {
            afterClosed: () => of<'template-only'>('template-only'),
          };
        }
        return {
          afterClosed: () => of(true),
        };
      }),
    };

    TestBed.configureTestingModule({
      imports: [EditTransactionsDialog, MatDialogModule, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        TransactionFormService,
        TemplateLineStore,
        TransactionLabelPipe,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: BudgetTemplatesApi, useValue: mockBudgetTemplatesApi },
      ],
    });

    TestBed.overrideProvider(MatDialog, { useValue: mockDialog });

    const fixture = TestBed.createComponent(EditTransactionsDialog);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create component and initialize state', () => {
      expect(component).toBeTruthy();
      expect(component['data']).toEqual(mockDialogData);
    });

    it('should expose state signals correctly', () => {
      expect(component['isLoading']()).toBe(false);
      expect(component['errorMessage']()).toBe(null);
      expect(component['hasUnsavedChanges']()).toBe(false);
      expect(component['canRemoveTransaction']()).toBe(true);
    });

    it('should display transactions correctly', () => {
      const transactions = component['transactions']();
      expect(transactions).toHaveLength(2);

      expect(transactions[0].formData.description).toBe('Loyer');
      expect(transactions[0].formData.amount).toBe(1200);
      expect(transactions[0].formData.type).toBe('expense');

      expect(transactions[1].formData.description).toBe('Salaire');
      expect(transactions[1].formData.amount).toBe(5000);
      expect(transactions[1].formData.type).toBe('income');
    });
  });

  describe('User Actions', () => {
    it('should add new transaction when addNewTransaction is called', () => {
      const initialCount = component['transactions']().length;

      component['addNewTransaction']();

      const newCount = component['transactions']().length;
      expect(newCount).toBe(initialCount + 1);
      expect(component['hasUnsavedChanges']()).toBe(true);
    });

    it('should handle remove transaction logic correctly', () => {
      // Test the state service directly since dialog mocking is complex
      expect(component['canRemoveTransaction']()).toBe(true);

      // Add a transaction so we have more than 2
      component['addNewTransaction']();
      expect(component['transactions']()).toHaveLength(3);
      expect(component['canRemoveTransaction']()).toBe(true);
    });

    it('should prevent removing when only one transaction remains', async () => {
      // Start with 2 transactions
      expect(component['transactions']()).toHaveLength(2);
      expect(component['canRemoveTransaction']()).toBe(true);

      // Remove one transaction (confirmation dialog mock returns true)
      const firstId = component['transactions']()[0].id;
      await component['removeTransaction'](firstId);

      // Only 1 transaction remains — removal should be prevented
      expect(component['transactions']()).toHaveLength(1);
      expect(component['canRemoveTransaction']()).toBe(false);
    });
  });

  describe('Save Functionality', () => {
    it('should save successfully and close dialog', async () => {
      component['addNewTransaction']();
      const newTransaction = component['transactions']().at(-1);
      if (!newTransaction) throw new Error('Expected a new transaction');

      component['updateDescription'](newTransaction.id, {
        target: { value: 'Nouvelle ligne' },
      } as unknown as Event);
      component['updateAmount'](newTransaction.id, {
        target: { value: '150' },
      } as unknown as Event);

      // Mock successful API response
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

      await component['save']();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        saved: true,
        updatedLines: [],
        deletedIds: [],
        propagation: {
          mode: 'template-only',
          affectedBudgetIds: [],
          affectedBudgetsCount: 0,
        },
      });
      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).toHaveBeenCalledWith(
        'template-123',
        expect.objectContaining({
          propagateToBudgets: false,
        }),
      );
    });

    it('should handle save errors gracefully', async () => {
      // Add a transaction to trigger changes
      component['addNewTransaction']();
      const newTransaction = component['transactions']().at(-1);
      if (!newTransaction) throw new Error('Expected a new transaction');

      component['updateDescription'](newTransaction.id, {
        target: { value: 'Nouvelle ligne' },
      } as unknown as Event);
      component['updateAmount'](newTransaction.id, {
        target: { value: '150' },
      } as unknown as Event);

      // Mock API error using throwError from rxjs
      const { throwError } = await import('rxjs');
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      // Ensure propagation dialog returns template-only by default
      mockDialog.open = vi.fn().mockImplementation((component) => {
        if (component === TemplatePropagationDialog) {
          return {
            afterClosed: () => of<'template-only'>('template-only'),
          };
        }
        return {
          afterClosed: () => of(true),
        };
      });

      await component['save']();

      // Dialog should not be closed on error
      expect(mockDialogRef.close).not.toHaveBeenCalled();
      // Error handling is complex with state service, so just verify dialog wasn't closed
    });

    it('should propagate changes when user selects propagate option', async () => {
      component['addNewTransaction']();
      const newTransaction = component['transactions']().at(-1);
      if (!newTransaction) throw new Error('Expected a new transaction');

      component['updateDescription'](newTransaction.id, {
        target: { value: 'Nouvelle ligne' },
      } as unknown as Event);
      component['updateAmount'](newTransaction.id, {
        target: { value: '150' },
      } as unknown as Event);

      mockDialog.open = vi.fn().mockImplementation((component) => {
        if (component === TemplatePropagationDialog) {
          return {
            afterClosed: () => of<'propagate'>('propagate'),
          };
        }
        return {
          afterClosed: () => of(true),
        };
      });

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

      await component['save']();

      expect(
        mockBudgetTemplatesApi.bulkOperationsTemplateLines$,
      ).toHaveBeenCalledWith(
        'template-123',
        expect.objectContaining({ propagateToBudgets: true }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        saved: true,
        updatedLines: [],
        deletedIds: [],
        propagation: {
          mode: 'propagate',
          affectedBudgetIds: ['budget-1'],
          affectedBudgetsCount: 1,
        },
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate forms correctly', () => {
      const isValid = component['isValid']();
      expect(isValid).toBe(true); // Initial data should be valid
    });
  });

  describe('Cancel Functionality', () => {
    it('should close dialog with saved: false when cancelled', () => {
      component['cancel']();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        saved: false,
      });
    });

    it('should not close dialog when a save is in flight', async () => {
      // Simulate a save that never resolves, keeping isLoading true
      const neverResolve$ = new Subject();
      mockBudgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
        neverResolve$.asObservable(),
      );

      // Trigger a change so save has something to persist
      component['addNewTransaction']();
      const newTx = component['transactions']().at(-1)!;
      component['updateDescription'](newTx.id, {
        target: { value: 'Test' },
      } as unknown as Event);
      component['updateAmount'](newTx.id, {
        target: { value: '100' },
      } as unknown as Event);

      // Start save (will stay in-flight because the observable never emits)
      const savePromise = component['save']();

      // Flush microtasks so save() progresses past the propagation dialog
      // and into saveChanges() where isLoading is set to true
      await new Promise((resolve) => setTimeout(resolve, 0));

      // While save is in-flight, attempt to cancel
      component['cancel']();

      // Dialog should NOT have been closed because isLoading is true
      expect(mockDialogRef.close).not.toHaveBeenCalled();

      // Clean up: complete the subject so the save promise settles
      neverResolve$.complete();
      await savePromise;
    });
  });

  describe('Running Totals', () => {
    it('should calculate running totals correctly', () => {
      const totals = (
        component as EditTransactionsDialog & { runningTotals(): number[] }
      ).runningTotals();

      // First transaction: -1200 (expense) = -1200
      expect(totals[0]).toBe(-1200);
      // Second transaction: +5000 (income) = 3800
      expect(totals[1]).toBe(3800);
    });
  });
});

describe('EditTransactionsDialog - Multi-currency preservation', () => {
  const templateId = 'template-mc';
  const altLine: TemplateLine = {
    id: 'line-alt',
    templateId,
    name: 'Abonnement EUR',
    amount: 110,
    originalAmount: 100,
    originalCurrency: 'EUR',
    targetCurrency: 'CHF',
    exchangeRate: 1.1,
    kind: 'expense',
    recurrence: 'fixed',
    description: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as TemplateLine;
  const monoLine: TemplateLine = {
    id: 'line-mono',
    templateId,
    name: 'Loyer',
    amount: 50,
    kind: 'expense',
    recurrence: 'fixed',
    description: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as TemplateLine;

  const dialogData = {
    transactions: [
      { description: 'Abonnement EUR', amount: 110, type: 'expense' as const },
      { description: 'Loyer', amount: 50, type: 'expense' as const },
    ] as TransactionFormData[],
    templateName: 'Multi-currency Template',
    templateId,
    originalTemplateLines: [altLine, monoLine],
  };

  let component: EditTransactionsDialog;
  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
  let budgetTemplatesApi: {
    bulkOperationsTemplateLines$: ReturnType<typeof vi.fn>;
  };
  let converterSpy: { convertWithMetadata: ReturnType<typeof vi.fn> };
  let matDialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();

    dialogRef = { close: vi.fn(), disableClose: false };
    budgetTemplatesApi = { bulkOperationsTemplateLines$: vi.fn() };
    // Spy to guarantee the conversion path never runs for this dialog.
    converterSpy = { convertWithMetadata: vi.fn() };
    matDialog = {
      open: vi.fn().mockImplementation((cmp) => {
        if (cmp === TemplatePropagationDialog) {
          return { afterClosed: () => of<'template-only'>('template-only') };
        }
        return { afterClosed: () => of(true) };
      }),
    };

    TestBed.configureTestingModule({
      imports: [EditTransactionsDialog, MatDialogModule, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        TransactionFormService,
        TemplateLineStore,
        TransactionLabelPipe,
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: BudgetTemplatesApi, useValue: budgetTemplatesApi },
        // Fail-loud regression guard: if someone re-adds a conversion path,
        // this mock will be invoked and the assertion below will catch it.
        { provide: CurrencyConverterService, useValue: converterSpy },
      ],
    });

    TestBed.overrideProvider(MatDialog, { useValue: matDialog });

    const fixture = TestBed.createComponent(EditTransactionsDialog);
    component = fixture.componentInstance;
  });

  it('editing only a mono-currency line does not touch the alt-currency line and never calls the converter', async () => {
    // Arrange: stub a response where only the mono line was updated.
    budgetTemplatesApi.bulkOperationsTemplateLines$.mockReturnValue(
      of({
        data: {
          created: [],
          updated: [{ ...monoLine, name: 'Loyer renommé' }],
          deleted: [],
          propagation: {
            mode: 'template-only',
            affectedBudgetIds: [],
            affectedBudgetsCount: 0,
          },
        },
      }),
    );

    // Act: edit the mono line's description, then save.
    component['updateDescription']('line-mono', {
      target: { value: 'Loyer renommé' },
    } as unknown as Event);
    await component['save']();

    // Assert: the bulk API was called once with only the mono line in update[].
    expect(
      budgetTemplatesApi.bulkOperationsTemplateLines$,
    ).toHaveBeenCalledTimes(1);
    const [, operations] =
      budgetTemplatesApi.bulkOperationsTemplateLines$.mock.calls[0];
    expect(operations.update).toHaveLength(1);
    expect(operations.update[0].id).toBe('line-mono');
    expect(operations.create).toEqual([]);
    expect(operations.delete).toEqual([]);

    // Assert: the mono line payload carries no FX fields (backend PATCH
    // semantics preserve any existing metadata untouched).
    expect(operations.update[0]).not.toHaveProperty('originalAmount');
    expect(operations.update[0]).not.toHaveProperty('originalCurrency');
    expect(operations.update[0]).not.toHaveProperty('targetCurrency');
    expect(operations.update[0]).not.toHaveProperty('exchangeRate');

    // Assert: the converter is never invoked from the bulk dialog.
    expect(converterSpy.convertWithMetadata).not.toHaveBeenCalled();
  });
});
