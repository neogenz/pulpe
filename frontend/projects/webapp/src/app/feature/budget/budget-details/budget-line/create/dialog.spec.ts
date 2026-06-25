import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import type { SupportedCurrency } from 'pulpe-shared';
import { AddBudgetLineDialog, type BudgetLineDialogData } from './dialog';

interface FlagsMock {
  isMultiCurrencyEnabled: ReturnType<typeof signal>;
}
interface SettingsMock {
  currency: ReturnType<typeof signal<SupportedCurrency>>;
  showCurrencySelector: ReturnType<typeof signal<boolean>>;
}
interface ConverterMock {
  convertWithMetadata: ReturnType<typeof vi.fn>;
  fetchRate: ReturnType<typeof vi.fn>;
  convert: ReturnType<typeof vi.fn>;
}
interface DialogRefMock {
  close: ReturnType<typeof vi.fn>;
}

function configureDialog({
  userCurrency = 'CHF',
  flagEnabled = false,
  showCurrencyPref = true,
}: {
  userCurrency?: SupportedCurrency;
  flagEnabled?: boolean;
  showCurrencyPref?: boolean;
} = {}) {
  const dialogRef: DialogRefMock = { close: vi.fn() };
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
    fetchRate: vi.fn().mockResolvedValue({ rate: 1 }),
    convert: vi.fn((amount: number) => amount),
  };

  TestBed.configureTestingModule({
    imports: [AddBudgetLineDialog],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      ...provideTranslocoForTest(),
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          budgetId: '00000000-0000-4000-8000-000000000123',
          budgetMonth: 6,
          budgetYear: 2026,
        } satisfies BudgetLineDialogData,
      },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: FeatureFlagsService, useValue: flags },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const fixture = TestBed.createComponent(AddBudgetLineDialog);
  const component = fixture.componentInstance;
  return { fixture, component, dialogRef, converter, settings, flags };
}

describe('AddBudgetLineDialog', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('submit', () => {
    it('should close with budget line data when form is valid', async () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: 'Loyer',
        kind: 'expense',
        recurrence: 'fixed',
        money: { amount: 1200, inputCurrency: 'CHF' },
      }));

      await component['handleSubmit']();

      expect(dialogRef.close).toHaveBeenCalledWith({
        mode: 'single',
        value: expect.objectContaining({
          budgetId: '00000000-0000-4000-8000-000000000123',
          name: 'Loyer',
          amount: 1200,
          kind: 'expense',
          recurrence: 'fixed',
          isManuallyAdjusted: true,
        }),
      });
    });

    it('should not close when form is invalid', async () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: '',
        money: { ...m.money, amount: null },
      }));

      await component['handleSubmit']();

      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should not close when currency conversion fails', async () => {
      const { component, dialogRef, converter } = configureDialog();
      converter.convertWithMetadata.mockRejectedValue(new Error('API down'));
      component['model'].update((m) => ({
        ...m,
        name: 'Loyer',
        money: { amount: 1200, inputCurrency: 'CHF' },
      }));

      await component['handleSubmit']();

      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(component['conversionError']()).toBe(true);
    });

    it('should trim whitespace from name', async () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: '  Assurance  ',
        money: { amount: 385, inputCurrency: 'CHF' },
      }));

      await component['handleSubmit']();

      expect(dialogRef.close).toHaveBeenCalledWith({
        mode: 'single',
        value: expect.objectContaining({ name: 'Assurance' }),
      });
    });
  });

  describe('checked toggle', () => {
    it('should set checkedAt to null by default', async () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { amount: 10, inputCurrency: 'CHF' },
      }));

      await component['handleSubmit']();

      expect(dialogRef.close).toHaveBeenCalledWith({
        mode: 'single',
        value: expect.objectContaining({ checkedAt: null }),
      });
    });

    it('should set checkedAt to ISO string when isChecked is true', async () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { amount: 10, inputCurrency: 'CHF' },
        isChecked: true,
      }));

      await component['handleSubmit']();

      const callArg = dialogRef.close.mock.calls[0][0];
      expect(callArg.mode).toBe('single');
      expect(callArg.value.checkedAt).toBeDefined();
      expect(typeof callArg.value.checkedAt).toBe('string');
      expect(() => new Date(callArg.value.checkedAt)).not.toThrow();
    });
  });

  describe('cancel', () => {
    it('should close without data', () => {
      const { component, dialogRef } = configureDialog();
      component['cancel']();

      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('spread amount mode', () => {
    it('should default the amount mode to total', () => {
      const { component } = configureDialog();

      expect(component['amountMode']()).toBe('total');
    });

    it('should submit a total-mode spread payload by default', async () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: 'Assurance',
        kind: 'expense',
        money: { amount: 600, inputCurrency: 'CHF' },
      }));
      component['setMode']('spread');

      await component['handleSubmit']();

      expect(dialogRef.close).toHaveBeenCalledWith({
        mode: 'spread',
        value: expect.objectContaining({
          name: 'Assurance',
          kind: 'expense',
          mode: 'total',
          totalAmount: 600,
        }),
      });
      const { value: dto } = dialogRef.close.mock.calls[0][0];
      expect(dto).not.toHaveProperty('perMonthAmount');
      expect(dto.months).toHaveLength(6);
    });

    it('should submit a perMonth-mode spread payload when selected', async () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: 'Assurance',
        kind: 'expense',
        money: { amount: 100, inputCurrency: 'CHF' },
      }));
      component['setMode']('spread');
      component['setAmountMode']('perMonth');

      await component['handleSubmit']();

      expect(dialogRef.close).toHaveBeenCalledWith({
        mode: 'spread',
        value: expect.objectContaining({
          mode: 'perMonth',
          perMonthAmount: 100,
        }),
      });
      const { value: dto } = dialogRef.close.mock.calls[0][0];
      expect(dto).not.toHaveProperty('totalAmount');
    });

    it('should split an uneven total preserving the sum to the cent', () => {
      const { component } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        money: { amount: 4000, inputCurrency: 'CHF' },
      }));
      component['setMode']('spread');
      component['setEnd']('2026-8');

      const amounts = component['breakdownRows']().map((row) => row.amount);

      // Cents-preserving division (4000 / 3): the remainder cent lands on the
      // first month so Σ === 4000 exactly. NOT integer-unit [1334, 1333, 1333].
      expect(amounts).toEqual([1333.34, 1333.33, 1333.33]);
      const sumCents = amounts.reduce((acc, a) => acc + Math.round(a * 100), 0);
      expect(sumCents).toBe(400000);
    });
  });

  describe('currency create rules', () => {
    it('should initialize money slice with user currency', () => {
      const { component } = configureDialog({ userCurrency: 'EUR' });

      expect(component['model']().money.inputCurrency).toBe('EUR');
      expect(component['model']().money.amount).toBeNull();
    });

    it('should call convertWithMetadata with (amount, inputCurrency, userCurrency) and include metadata in payload when currencies differ', async () => {
      const { component, dialogRef, converter } = configureDialog({
        userCurrency: 'CHF',
        flagEnabled: true,
      });
      converter.convertWithMetadata.mockResolvedValue({
        convertedAmount: 180,
        metadata: {
          originalAmount: 150,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 1.2,
        },
      });

      component['model'].update((m) => ({
        ...m,
        name: 'Loyer',
        kind: 'expense',
        recurrence: 'fixed',
        money: { amount: 150, inputCurrency: 'EUR' },
      }));

      await component['handleSubmit']();

      expect(converter.convertWithMetadata).toHaveBeenCalledWith(
        150,
        'EUR',
        'CHF',
      );
      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      const { value: dto } = dialogRef.close.mock.calls[0][0];
      expect(dto.amount).toBe(180);
      expect(dto.originalAmount).toBe(150);
      expect(dto.originalCurrency).toBe('EUR');
      expect(dto.targetCurrency).toBe('CHF');
      expect(dto.exchangeRate).toBe(1.2);
    });

    it('should omit metadata fields from payload when inputCurrency equals userCurrency', async () => {
      const { component, dialogRef, converter } = configureDialog({
        userCurrency: 'CHF',
        flagEnabled: true,
      });
      converter.convertWithMetadata.mockResolvedValue({
        convertedAmount: 1200,
        metadata: null,
      });

      component['model'].update((m) => ({
        ...m,
        name: 'Loyer',
        kind: 'expense',
        recurrence: 'fixed',
        money: { amount: 1200, inputCurrency: 'CHF' },
      }));

      await component['handleSubmit']();

      expect(converter.convertWithMetadata).toHaveBeenCalledWith(
        1200,
        'CHF',
        'CHF',
      );
      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      const { value: dto } = dialogRef.close.mock.calls[0][0];
      expect(dto.amount).toBe(1200);
      expect(dto).not.toHaveProperty('originalAmount');
      expect(dto).not.toHaveProperty('originalCurrency');
      expect(dto).not.toHaveProperty('targetCurrency');
      expect(dto).not.toHaveProperty('exchangeRate');
    });
  });

  describe('a11y conversion error announcement', () => {
    beforeEach(() => TestBed.resetTestingModule());

    it('should expose role="alert" on the conversion error block when conversionError is true', () => {
      const { fixture, component } = configureDialog();

      component['conversionError'].set(true);
      fixture.detectChanges();

      const errorEl = fixture.nativeElement.querySelector('p[role="alert"]');
      expect(errorEl).not.toBeNull();
      expect(errorEl?.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('should NOT render the alert element when conversionError is false', () => {
      const { fixture, component } = configureDialog();

      component['conversionError'].set(false);
      fixture.detectChanges();

      const errorEl = fixture.nativeElement.querySelector('p[role="alert"]');
      expect(errorEl).toBeNull();
    });
  });
});
