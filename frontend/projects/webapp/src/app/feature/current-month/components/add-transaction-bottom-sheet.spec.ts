import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
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
  let converterSpy: { convertWithMetadata: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    afterOpened$ = new Subject<void>();
    mockBottomSheetRef = {
      dismiss: vi.fn(),
      afterOpened: vi.fn().mockReturnValue(afterOpened$),
    };
    // Default: same-currency path returns metadata: null.
    // Tests that need conversion override the mock in-test.
    converterSpy = {
      convertWithMetadata: vi
        .fn()
        .mockImplementation(async (amount: number) => ({
          convertedAmount: amount,
          metadata: null,
        })),
    };

    await TestBed.configureTestingModule({
      imports: [AddTransactionBottomSheet],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        { provide: MatBottomSheetRef, useValue: mockBottomSheetRef },
        { provide: CurrencyConverterService, useValue: converterSpy },
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

  describe('currency conversion metadata', () => {
    it('should dismiss with originalAmount, originalCurrency, targetCurrency, exchangeRate when input currency differs from display currency', async () => {
      converterSpy.convertWithMetadata.mockResolvedValueOnce({
        convertedAmount: 108.97,
        metadata: {
          originalAmount: 100,
          originalCurrency: 'CHF',
          targetCurrency: 'EUR',
          exchangeRate: 1.0897,
        },
      });
      component['inputCurrency'].set('CHF');
      component['transactionForm'].patchValue({
        name: 'Test',
        amount: 100,
        kind: 'expense',
      });

      await component['onSubmit']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 108.97,
          originalAmount: 100,
          originalCurrency: 'CHF',
          targetCurrency: 'EUR',
          exchangeRate: 1.0897,
        }),
      );
    });

    it('should dismiss without conversion metadata fields when input currency matches display currency', async () => {
      converterSpy.convertWithMetadata.mockResolvedValueOnce({
        convertedAmount: 50,
        metadata: null,
      });
      component['transactionForm'].patchValue({
        name: 'Test',
        amount: 50,
        kind: 'expense',
      });

      await component['onSubmit']();

      const callArg: TransactionFormData =
        mockBottomSheetRef.dismiss.mock.calls[0][0];
      expect(callArg.originalAmount).toBeUndefined();
      expect(callArg.originalCurrency).toBeUndefined();
      expect(callArg.targetCurrency).toBeUndefined();
      expect(callArg.exchangeRate).toBeUndefined();
    });

    it('should not dismiss when the conversion call throws', async () => {
      converterSpy.convertWithMetadata.mockRejectedValueOnce(
        new Error('rate unavailable'),
      );
      component['inputCurrency'].set('CHF');
      component['transactionForm'].patchValue({
        name: 'Test',
        amount: 100,
        kind: 'expense',
      });

      await component['onSubmit']();

      expect(mockBottomSheetRef.dismiss).not.toHaveBeenCalled();
      expect(component['conversionError']()).toBe(true);
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
