import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  AddTransactionBottomSheet,
  type TransactionFormData,
} from './add-transaction-bottom-sheet';
import { Subject } from 'rxjs';

describe('AddTransactionBottomSheet', () => {
  let component: AddTransactionBottomSheet;
  let mockBottomSheetRef: {
    dismiss: ReturnType<typeof vi.fn>;
    afterOpened: ReturnType<typeof vi.fn>;
  };
  let afterOpened$: Subject<void>;

  beforeEach(async () => {
    afterOpened$ = new Subject<void>();
    mockBottomSheetRef = {
      dismiss: vi.fn(),
      afterOpened: vi.fn().mockReturnValue(afterOpened$),
    };

    await TestBed.configureTestingModule({
      imports: [AddTransactionBottomSheet],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        { provide: MatBottomSheetRef, useValue: mockBottomSheetRef },
      ],
    }).compileComponents();

    component = TestBed.createComponent(
      AddTransactionBottomSheet,
    ).componentInstance;
  });

  describe('submit', () => {
    it('should dismiss with transaction data when form is valid', async () => {
      component['transactionForm'].patchValue({
        name: 'Courses Migros',
        amount: 45.5,
        kind: 'expense',
      });

      await component['onSubmit']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Courses Migros',
          amount: 45.5,
          kind: 'expense',
          category: null,
        }),
      );
    });

    it('should not dismiss when form is invalid', () => {
      component['transactionForm'].patchValue({ name: '', amount: null });

      component['onSubmit']();

      expect(mockBottomSheetRef.dismiss).not.toHaveBeenCalled();
    });

    it('should apply Math.abs on amount', async () => {
      component['transactionForm'].patchValue({
        name: 'Test',
        amount: 42.5,
        kind: 'expense',
      });

      await component['onSubmit']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 42.5 }),
      );
    });

    it('should convert empty category to null', async () => {
      component['transactionForm'].patchValue({
        name: 'Test',
        amount: 10,
        kind: 'expense',
        category: '',
      });

      await component['onSubmit']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ category: null }),
      );
    });
  });

  describe('checked toggle', () => {
    it('should set checkedAt to ISO string when isChecked is true (default)', async () => {
      component['transactionForm'].patchValue({
        name: 'Test',
        amount: 10,
        kind: 'expense',
      });

      await component['onSubmit']();

      const callArg: TransactionFormData =
        mockBottomSheetRef.dismiss.mock.calls[0][0];
      expect(callArg.checkedAt).toBeDefined();
      expect(typeof callArg.checkedAt).toBe('string');
      expect(() => new Date(callArg.checkedAt!)).not.toThrow();
    });

    it('should set checkedAt to null when isChecked is false', async () => {
      component['transactionForm'].patchValue({
        name: 'Test',
        amount: 10,
        kind: 'expense',
        isChecked: false,
      });

      await component['onSubmit']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ checkedAt: null }),
      );
    });
  });

  describe('close', () => {
    it('should dismiss without data', () => {
      component['close']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith();
    });
  });

  describe('form validation', () => {
    it('should require name', () => {
      component['transactionForm'].get('name')?.setValue('');

      expect(
        component['transactionForm'].get('name')?.hasError('required'),
      ).toBe(true);
    });

    it('should enforce max length on name', () => {
      component['transactionForm'].get('name')?.setValue('a'.repeat(101));

      expect(
        component['transactionForm'].get('name')?.hasError('maxlength'),
      ).toBe(true);
    });

    it('should require amount', () => {
      component['transactionForm'].get('amount')?.setValue(null);

      expect(
        component['transactionForm'].get('amount')?.hasError('required'),
      ).toBe(true);
    });

    it('should reject amount below 0.01', () => {
      component['transactionForm'].get('amount')?.setValue(0);

      expect(component['transactionForm'].get('amount')?.hasError('min')).toBe(
        true,
      );
    });

    it('should reject negative amount', () => {
      component['transactionForm'].get('amount')?.setValue(-50);

      expect(component['transactionForm'].get('amount')?.hasError('min')).toBe(
        true,
      );
    });

    it('should require kind', () => {
      component['transactionForm'].get('kind')?.setValue(null);

      expect(
        component['transactionForm'].get('kind')?.hasError('required'),
      ).toBe(true);
    });
  });

  describe('predefined amounts', () => {
    it('should patch form amount when selecting predefined amount', () => {
      component['selectPredefinedAmount'](20);

      expect(component['transactionForm'].get('amount')?.value).toBe(20);
    });
  });
});
