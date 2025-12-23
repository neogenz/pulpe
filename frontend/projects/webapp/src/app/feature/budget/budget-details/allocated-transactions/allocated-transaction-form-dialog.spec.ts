import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import type { Transaction, TransactionKind } from '@pulpe/shared';
import { createMockTransaction } from '../../../../testing/mock-factories';
import {
  AllocatedTransactionFormDialog,
  type AllocatedTransactionFormDialogData,
  type AllocatedTransactionFormResult,
} from './allocated-transaction-form-dialog';

describe('AllocatedTransactionFormDialog', () => {
  let fixture: ComponentFixture<AllocatedTransactionFormDialog>;
  let component: AllocatedTransactionFormDialog;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  const baseDialogData: AllocatedTransactionFormDialogData = {
    budgetLineId: 'line-1',
    budgetId: 'budget-1',
    kind: 'expense' as TransactionKind,
  };

  async function setupComponent(
    dialogData: AllocatedTransactionFormDialogData,
  ): Promise<void> {
    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AllocatedTransactionFormDialog, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AllocatedTransactionFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('Creation Mode', () => {
    beforeEach(async () => {
      await setupComponent(baseDialogData);
    });

    it('should have empty form fields in creation mode', () => {
      expect(component.form.value.name).toBe('');
      expect(component.form.value.amount).toBe(null);
    });

    it('should default transaction date to today', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(component.form.value.transactionDate).toBe(today);
    });

    it('should be in creation mode when no transaction provided', () => {
      expect(component.isEditMode()).toBe(false);
    });

    it('should display creation title', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const title = compiled.querySelector('[data-testid="dialog-title"]');

      expect(title?.textContent).toContain('Ajouter');
    });

    it('should display create button text', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const submitBtn = compiled.querySelector(
        '[data-testid="submit-button"]',
      ) as HTMLButtonElement;

      expect(submitBtn?.textContent).toContain('Ajouter');
    });
  });

  describe('Edit Mode', () => {
    const existingTransaction: Transaction = createMockTransaction({
      id: 'tx-1',
      budgetId: 'budget-1',
      budgetLineId: 'line-1',
      name: 'Plein essence',
      amount: 65,
      kind: 'expense',
      transactionDate: '2024-12-15',
    });

    beforeEach(async () => {
      await setupComponent({
        ...baseDialogData,
        transaction: existingTransaction,
      });
    });

    it('should pre-fill form fields in edit mode', () => {
      expect(component.form.value.name).toBe('Plein essence');
      expect(component.form.value.amount).toBe(65);
      expect(component.form.value.transactionDate).toBe('2024-12-15');
    });

    it('should be in edit mode when transaction provided', () => {
      expect(component.isEditMode()).toBe(true);
    });

    it('should display edit title', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const title = compiled.querySelector('[data-testid="dialog-title"]');

      expect(title?.textContent).toContain('Modifier');
    });

    it('should display update button text', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const submitBtn = compiled.querySelector(
        '[data-testid="submit-button"]',
      ) as HTMLButtonElement;

      expect(submitBtn?.textContent).toContain('Enregistrer');
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      await setupComponent(baseDialogData);
    });

    it('should require name field', () => {
      component.form.patchValue({ name: '', amount: 100 });
      fixture.detectChanges();

      expect(component.form.valid).toBe(false);
      expect(component.form.get('name')?.errors?.['required']).toBeTruthy();
    });

    it('should require amount field', () => {
      component.form.patchValue({ name: 'Test', amount: null });
      fixture.detectChanges();

      expect(component.form.valid).toBe(false);
      expect(component.form.get('amount')?.errors?.['required']).toBeTruthy();
    });

    it('should require amount > 0', () => {
      component.form.patchValue({ name: 'Test', amount: 0 });
      fixture.detectChanges();

      expect(component.form.valid).toBe(false);
      expect(component.form.get('amount')?.errors?.['min']).toBeTruthy();
    });

    it('should reject negative amounts', () => {
      component.form.patchValue({ name: 'Test', amount: -50 });
      fixture.detectChanges();

      expect(component.form.valid).toBe(false);
      expect(component.form.get('amount')?.errors?.['min']).toBeTruthy();
    });

    it('should accept valid form data', () => {
      component.form.patchValue({
        name: 'Plein essence',
        amount: 65,
        transactionDate: '2024-12-15',
      });
      fixture.detectChanges();

      expect(component.form.valid).toBe(true);
    });

    it('should disable submit button when form is invalid', () => {
      component.form.patchValue({ name: '', amount: null });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const submitBtn = compiled.querySelector(
        '[data-testid="submit-button"]',
      ) as HTMLButtonElement;

      expect(submitBtn?.disabled).toBe(true);
    });

    it('should enable submit button when form is valid', () => {
      component.form.patchValue({ name: 'Test', amount: 100 });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const submitBtn = compiled.querySelector(
        '[data-testid="submit-button"]',
      ) as HTMLButtonElement;

      expect(submitBtn?.disabled).toBe(false);
    });
  });

  describe('Form Submission', () => {
    describe('Creation Mode', () => {
      beforeEach(async () => {
        await setupComponent(baseDialogData);
      });

      it('should return TransactionCreate on submit in creation mode', () => {
        component.form.patchValue({
          name: 'Nouveau plein',
          amount: 75,
          transactionDate: '2024-12-20',
        });
        fixture.detectChanges();

        component.submit();

        expect(mockDialogRef.close).toHaveBeenCalledWith({
          mode: 'create',
          data: {
            budgetId: 'budget-1',
            budgetLineId: 'line-1',
            kind: 'expense',
            name: 'Nouveau plein',
            amount: 75,
            transactionDate: '2024-12-20T00:00:00.000Z',
          },
        } satisfies AllocatedTransactionFormResult);
      });

      it('should include hidden fields (budgetId, budgetLineId, kind)', () => {
        component.form.patchValue({
          name: 'Test',
          amount: 50,
          transactionDate: '2024-12-20',
        });
        fixture.detectChanges();

        component.submit();

        const closeArg = mockDialogRef.close.mock
          .calls[0][0] as AllocatedTransactionFormResult;
        expect(closeArg.mode).toBe('create');
        if (closeArg.mode === 'create') {
          expect(closeArg.data.budgetId).toBe('budget-1');
          expect(closeArg.data.budgetLineId).toBe('line-1');
          expect(closeArg.data.kind).toBe('expense');
        }
      });
    });

    describe('Edit Mode', () => {
      const existingTransaction: Transaction = createMockTransaction({
        id: 'tx-1',
        budgetId: 'budget-1',
        budgetLineId: 'line-1',
        name: 'Plein essence',
        amount: 65,
        kind: 'expense',
        transactionDate: '2024-12-15',
      });

      beforeEach(async () => {
        await setupComponent({
          ...baseDialogData,
          transaction: existingTransaction,
        });
      });

      it('should return TransactionUpdate on submit in edit mode', () => {
        component.form.patchValue({
          name: 'Plein essence modifié',
          amount: 80,
        });
        fixture.detectChanges();

        component.submit();

        expect(mockDialogRef.close).toHaveBeenCalledWith({
          mode: 'update',
          transactionId: 'tx-1',
          originalAmount: 65,
          data: {
            name: 'Plein essence modifié',
            amount: 80,
            transactionDate: '2024-12-15T00:00:00.000Z',
          },
        } satisfies AllocatedTransactionFormResult);
      });

      it('should include transactionId in edit mode result', () => {
        component.form.patchValue({ amount: 70 });
        fixture.detectChanges();

        component.submit();

        const closeArg = mockDialogRef.close.mock
          .calls[0][0] as AllocatedTransactionFormResult;
        expect(closeArg.mode).toBe('update');
        if (closeArg.mode === 'update') {
          expect(closeArg.transactionId).toBe('tx-1');
        }
      });

      it('should include original amount for delta calculation', () => {
        component.form.patchValue({ amount: 100 });
        fixture.detectChanges();

        component.submit();

        const closeArg = mockDialogRef.close.mock
          .calls[0][0] as AllocatedTransactionFormResult;
        expect(closeArg.mode).toBe('update');
        if (closeArg.mode === 'update') {
          expect(closeArg.originalAmount).toBe(65);
        }
      });
    });
  });

  describe('Cancel Action', () => {
    beforeEach(async () => {
      await setupComponent(baseDialogData);
    });

    it('should close dialog without result on cancel', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const cancelBtn = compiled.querySelector(
        '[data-testid="cancel-button"]',
      ) as HTMLButtonElement;

      cancelBtn?.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await setupComponent(baseDialogData);
    });

    it('should have proper labels on form fields', () => {
      const compiled = fixture.nativeElement as HTMLElement;

      const nameInput = compiled.querySelector('input[formControlName="name"]');
      const amountInput = compiled.querySelector(
        'input[formControlName="amount"]',
      );

      expect(nameInput).toBeTruthy();
      expect(amountInput).toBeTruthy();
    });
  });
});
