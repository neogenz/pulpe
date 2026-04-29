import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { EMPTY } from 'rxjs';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import type { SupportedCurrency } from 'pulpe-shared';
import {
  AddTransactionBottomSheet,
  type TransactionFormData,
} from './add-transaction-bottom-sheet';

interface FlagsMock {
  isMultiCurrencyEnabled: ReturnType<typeof signal>;
}
interface SettingsMock {
  currency: ReturnType<typeof signal<SupportedCurrency>>;
  showCurrencySelector: ReturnType<typeof signal<boolean>>;
}
interface ConverterMock {
  convertWithMetadata: ReturnType<typeof vi.fn>;
}
interface BottomSheetRefMock {
  dismiss: ReturnType<typeof vi.fn>;
  afterOpened: ReturnType<typeof vi.fn>;
}

function configureBottomSheet({
  userCurrency = 'CHF' as SupportedCurrency,
  flagEnabled = false,
  showCurrencyPref = true,
}: {
  userCurrency?: SupportedCurrency;
  flagEnabled?: boolean;
  showCurrencyPref?: boolean;
} = {}) {
  const bottomSheetRef: BottomSheetRefMock = {
    dismiss: vi.fn(),
    afterOpened: vi.fn().mockReturnValue(EMPTY),
  };
  const flags: FlagsMock = {
    isMultiCurrencyEnabled: signal(flagEnabled),
  };
  const settings: SettingsMock = {
    currency: signal<SupportedCurrency>(userCurrency),
    showCurrencySelector: signal(showCurrencyPref),
  };
  const converter: ConverterMock = {
    convertWithMetadata: vi.fn().mockImplementation(async (amount: number) => ({
      convertedAmount: amount,
      metadata: null,
    })),
  };

  TestBed.configureTestingModule({
    imports: [AddTransactionBottomSheet],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      ...provideTranslocoForTest(),
      { provide: MatBottomSheetRef, useValue: bottomSheetRef },
      { provide: FeatureFlagsService, useValue: flags },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const fixture = TestBed.createComponent(AddTransactionBottomSheet);
  const component = fixture.componentInstance;
  return { fixture, component, bottomSheetRef, converter, settings, flags };
}

describe('AddTransactionBottomSheet', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('submit', () => {
    it('should dismiss with transaction data when form is valid', async () => {
      const { component, bottomSheetRef } = configureBottomSheet();
      component['model'].update((m) => ({
        ...m,
        name: 'Courses Migros',
        money: { ...m.money, amount: 45.5 },
        kind: 'expense',
      }));

      await component['onSubmit']();

      expect(bottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Courses Migros',
          amount: 45.5,
          kind: 'expense',
          category: null,
        }),
      );
    });

    it('should not dismiss when form is invalid', async () => {
      const { component, bottomSheetRef } = configureBottomSheet();
      component['model'].update((m) => ({
        ...m,
        name: '',
        money: { ...m.money, amount: Number.NaN },
      }));

      await component['onSubmit']();

      expect(bottomSheetRef.dismiss).not.toHaveBeenCalled();
    });

    it('should convert empty category to null', async () => {
      const { component, bottomSheetRef } = configureBottomSheet();
      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { ...m.money, amount: 10 },
        kind: 'expense',
        category: '',
      }));

      await component['onSubmit']();

      expect(bottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ category: null }),
      );
    });

    it('should not dismiss when the conversion call throws', async () => {
      const { component, bottomSheetRef, converter } = configureBottomSheet();
      converter.convertWithMetadata.mockRejectedValueOnce(
        new Error('rate unavailable'),
      );
      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { amount: 100, inputCurrency: 'CHF' },
      }));

      await component['onSubmit']();

      expect(bottomSheetRef.dismiss).not.toHaveBeenCalled();
      expect(component['conversionError']()).toBe(true);
    });
  });

  describe('checked toggle', () => {
    it('should set checkedAt to ISO string when isChecked is true (default)', async () => {
      const { component, bottomSheetRef } = configureBottomSheet();
      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { ...m.money, amount: 10 },
        kind: 'expense',
        isChecked: true,
      }));

      await component['onSubmit']();

      const callArg: TransactionFormData =
        bottomSheetRef.dismiss.mock.calls[0][0];
      expect(callArg.checkedAt).toBeDefined();
      expect(typeof callArg.checkedAt).toBe('string');
      expect(() => new Date(callArg.checkedAt!)).not.toThrow();
    });

    it('should set checkedAt to null when isChecked is false', async () => {
      const { component, bottomSheetRef } = configureBottomSheet();
      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { ...m.money, amount: 10 },
        kind: 'expense',
        isChecked: false,
      }));

      await component['onSubmit']();

      expect(bottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ checkedAt: null }),
      );
    });
  });

  describe('close', () => {
    it('should dismiss without data', () => {
      const { component, bottomSheetRef } = configureBottomSheet();

      component['close']();

      expect(bottomSheetRef.dismiss).toHaveBeenCalledWith();
    });
  });

  describe('form validation', () => {
    it('should require name', () => {
      const { component } = configureBottomSheet();
      component['model'].update((m) => ({ ...m, name: '' }));

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((e) => e.kind === 'required'),
      ).toBe(true);
    });

    it('should enforce max length on name', () => {
      const { component } = configureBottomSheet();
      component['model'].update((m) => ({ ...m, name: 'a'.repeat(101) }));

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((e) => e.kind === 'maxLength'),
      ).toBe(true);
    });

    it('should require amount', () => {
      const { component } = configureBottomSheet();
      component['model'].update((m) => ({
        ...m,
        money: { ...m.money, amount: Number.NaN },
      }));

      expect(
        component['transactionForm'].money
          .amount()
          .errors()
          .some((e) => e.kind === 'required'),
      ).toBe(true);
    });

    it('should reject amount below 0.01', () => {
      const { component } = configureBottomSheet();
      component['model'].update((m) => ({
        ...m,
        money: { ...m.money, amount: 0 },
      }));

      expect(
        component['transactionForm'].money
          .amount()
          .errors()
          .some((e) => e.kind === 'min'),
      ).toBe(true);
    });

    it('should reject negative amount', () => {
      const { component } = configureBottomSheet();
      component['model'].update((m) => ({
        ...m,
        money: { ...m.money, amount: -50 },
      }));

      expect(
        component['transactionForm'].money
          .amount()
          .errors()
          .some((e) => e.kind === 'min'),
      ).toBe(true);
    });
  });

  describe('predefined amounts', () => {
    it('should update model amount when selecting predefined amount', () => {
      const { component } = configureBottomSheet();

      component['selectPredefinedAmount'](20);

      expect(component['model']().money.amount).toBe(20);
    });
  });

  describe('currency create rules', () => {
    it('should initialize money slice with user currency', () => {
      const { component } = configureBottomSheet({ userCurrency: 'EUR' });

      expect(component['model']().money.inputCurrency).toBe('EUR');
      expect(component['model']().money.amount).toBeNaN();
    });

    it('should call convertWithMetadata with (amount, inputCurrency, userCurrency) and include metadata in payload when currencies differ', async () => {
      const { component, bottomSheetRef, converter } = configureBottomSheet({
        userCurrency: 'CHF',
        flagEnabled: true,
      });
      converter.convertWithMetadata.mockResolvedValueOnce({
        convertedAmount: 108.97,
        metadata: {
          originalAmount: 100,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 1.0897,
        },
      });

      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { amount: 100, inputCurrency: 'EUR' },
      }));

      await component['onSubmit']();

      expect(converter.convertWithMetadata).toHaveBeenCalledWith(
        100,
        'EUR',
        'CHF',
      );
      expect(bottomSheetRef.dismiss).toHaveBeenCalledTimes(1);
      const dto: TransactionFormData = bottomSheetRef.dismiss.mock.calls[0][0];
      expect(dto.amount).toBe(108.97);
      expect(dto.originalAmount).toBe(100);
      expect(dto.originalCurrency).toBe('EUR');
      expect(dto.targetCurrency).toBe('CHF');
      expect(dto.exchangeRate).toBe(1.0897);
    });

    it('should dismiss without conversion metadata fields when input currency matches display currency', async () => {
      const { component, bottomSheetRef, converter } = configureBottomSheet({
        userCurrency: 'CHF',
        flagEnabled: true,
      });
      converter.convertWithMetadata.mockResolvedValueOnce({
        convertedAmount: 50,
        metadata: null,
      });

      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { amount: 50, inputCurrency: 'CHF' },
      }));

      await component['onSubmit']();

      const callArg: TransactionFormData =
        bottomSheetRef.dismiss.mock.calls[0][0];
      expect(callArg.originalAmount).toBeUndefined();
      expect(callArg.originalCurrency).toBeUndefined();
      expect(callArg.targetCurrency).toBeUndefined();
      expect(callArg.exchangeRate).toBeUndefined();
    });
  });
});
