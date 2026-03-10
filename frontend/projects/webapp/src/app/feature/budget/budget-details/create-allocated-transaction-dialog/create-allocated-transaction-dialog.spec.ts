import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  CreateAllocatedTransactionDialog,
  type CreateAllocatedTransactionDialogData,
} from './create-allocated-transaction-dialog';

const createDialogData = (
  overrides: Partial<CreateAllocatedTransactionDialogData['budgetLine']> = {},
): CreateAllocatedTransactionDialogData => ({
  budgetLine: {
    id: 'bl-123',
    budgetId: 'budget-456',
    name: 'Assurance maladie',
    amount: 385,
    kind: 'expense',
    frequency: 'monthly',
    savingsGoalId: null,
    isRollover: false,
    rolloverSourceBudgetId: undefined,
    ...overrides,
  } as CreateAllocatedTransactionDialogData['budgetLine'],
  budgetMonth: new Date().getMonth() + 1,
  budgetYear: new Date().getFullYear(),
  payDayOfMonth: null,
});

describe('CreateAllocatedTransactionDialog', () => {
  let component: CreateAllocatedTransactionDialog;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let dialogData: CreateAllocatedTransactionDialogData;

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };
    dialogData = createDialogData();

    await TestBed.configureTestingModule({
      imports: [CreateAllocatedTransactionDialog],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideNativeDateAdapter(),
        ...provideTranslocoForTest(),
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    component = TestBed.createComponent(
      CreateAllocatedTransactionDialog,
    ).componentInstance;
  });

  describe('submit', () => {
    it('should close with transaction data when form is valid', () => {
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component.form.patchValue({
        name: 'Consultation médecin',
        amount: 45.5,
        transactionDate: midMonth,
      });

      component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetId: 'budget-456',
          budgetLineId: 'bl-123',
          name: 'Consultation médecin',
          amount: 45.5,
          kind: 'expense',
          category: null,
        }),
      );
    });

    it('should not close when form is invalid', () => {
      component.form.patchValue({ name: '', amount: null });

      component.submit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should trim whitespace from name', () => {
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component.form.patchValue({
        name: '  Courses  ',
        amount: 20,
        transactionDate: midMonth,
      });

      component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Courses' }),
      );
    });

    it('should apply Math.abs on amount', () => {
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component.form.patchValue({
        name: 'Test',
        amount: 42.5,
        transactionDate: midMonth,
      });

      component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 42.5 }),
      );
    });
  });

  describe('cancel', () => {
    it('should close without data', () => {
      component.cancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('form validation', () => {
    it('should require name', () => {
      component.form.get('name')?.setValue('');

      expect(component.form.get('name')?.hasError('required')).toBe(true);
    });

    it('should enforce max length on name', () => {
      component.form.get('name')?.setValue('a'.repeat(101));

      expect(component.form.get('name')?.hasError('maxlength')).toBe(true);
    });

    it('should require amount', () => {
      component.form.get('amount')?.setValue(null);

      expect(component.form.get('amount')?.hasError('required')).toBe(true);
    });

    it('should reject amount below 0.01', () => {
      component.form.get('amount')?.setValue(0);

      expect(component.form.get('amount')?.hasError('min')).toBe(true);
    });

    it('should reject negative amount', () => {
      component.form.get('amount')?.setValue(-50);

      expect(component.form.get('amount')?.hasError('min')).toBe(true);
    });

    it('should require transaction date', () => {
      component.form.get('transactionDate')?.setValue(null);

      expect(component.form.get('transactionDate')?.hasError('required')).toBe(
        true,
      );
    });
  });

  describe('checked toggle', () => {
    it('should set checkedAt to null by default', () => {
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component.form.patchValue({
        name: 'Test',
        amount: 10,
        transactionDate: midMonth,
      });

      component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ checkedAt: null }),
      );
    });

    it('should set checkedAt to ISO string when isChecked is true', () => {
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component.form.patchValue({
        name: 'Test',
        amount: 10,
        transactionDate: midMonth,
        isChecked: true,
      });

      component.submit();

      const callArg = mockDialogRef.close.mock.calls[0][0];
      expect(callArg.checkedAt).toBeDefined();
      expect(typeof callArg.checkedAt).toBe('string');
      expect(() => new Date(callArg.checkedAt)).not.toThrow();
    });
  });
});
