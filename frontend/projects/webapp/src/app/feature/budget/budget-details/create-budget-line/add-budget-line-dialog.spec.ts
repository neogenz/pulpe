import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  AddBudgetLineDialog,
  type BudgetLineDialogData,
} from './add-budget-line-dialog';

describe('AddBudgetLineDialog', () => {
  let component: AddBudgetLineDialog;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddBudgetLineDialog],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { budgetId: 'budget-123' } satisfies BudgetLineDialogData,
        },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    component = TestBed.createComponent(AddBudgetLineDialog).componentInstance;
  });

  describe('submit', () => {
    it('should close with budget line data when form is valid', () => {
      component.form.patchValue({
        name: 'Loyer',
        amount: 1200,
        kind: 'expense',
        recurrence: 'fixed',
      });

      component.handleSubmit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetId: 'budget-123',
          name: 'Loyer',
          amount: 1200,
          kind: 'expense',
          recurrence: 'fixed',
          isManuallyAdjusted: true,
        }),
      );
    });

    it('should not close when form is invalid', () => {
      component.form.patchValue({ name: '', amount: null });

      component.handleSubmit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should trim whitespace from name', () => {
      component.form.patchValue({
        name: '  Assurance  ',
        amount: 385,
      });

      component.handleSubmit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Assurance' }),
      );
    });
  });

  describe('checked toggle', () => {
    it('should set checkedAt to null by default', () => {
      component.form.patchValue({ name: 'Test', amount: 10 });

      component.handleSubmit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ checkedAt: null }),
      );
    });

    it('should set checkedAt to ISO string when isChecked is true', () => {
      component.form.patchValue({
        name: 'Test',
        amount: 10,
        isChecked: true,
      });

      component.handleSubmit();

      const callArg = mockDialogRef.close.mock.calls[0][0];
      expect(callArg.checkedAt).toBeDefined();
      expect(typeof callArg.checkedAt).toBe('string');
      expect(() => new Date(callArg.checkedAt)).not.toThrow();
    });
  });

  describe('cancel', () => {
    it('should close without data', () => {
      component.handleCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
