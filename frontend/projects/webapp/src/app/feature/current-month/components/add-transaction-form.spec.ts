import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupportedCurrency } from 'pulpe-shared';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import {
  AddTransactionForm,
  type TransactionFormData,
} from './add-transaction-form';

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

function configureForm({
  userCurrency = 'CHF' as SupportedCurrency,
  flagEnabled = false,
  showCurrencyPref = true,
}: {
  userCurrency?: SupportedCurrency;
  flagEnabled?: boolean;
  showCurrencyPref?: boolean;
} = {}) {
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
    imports: [AddTransactionForm],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      ...provideTranslocoForTest(),
      { provide: FeatureFlagsService, useValue: flags },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const fixture = TestBed.createComponent(AddTransactionForm);
  const component = fixture.componentInstance;
  const createdSpy = vi.fn<(tx: TransactionFormData) => void>();
  component.created.subscribe(createdSpy);

  return { fixture, component, createdSpy, converter };
}

describe('AddTransactionForm', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('predefined amounts', () => {
    it('renders the four quick amounts with 44px minimum targets', () => {
      const { fixture } = configureForm();
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll(
        'button[matButton="tonal"]',
      );
      expect(buttons.length).toBe(4);
      expect(buttons[0].classList).toContain('min-h-11');
    });

    it('updates and touches the amount field', () => {
      const { component } = configureForm();

      component['selectPredefinedAmount'](20);

      expect(component['transactionForm'].money.amount().value()).toBe(20);
      expect(component['transactionForm'].money.amount().touched()).toBe(true);
    });
  });

  describe('submit', () => {
    it('emits transaction data when the form is valid', async () => {
      const { component, createdSpy } = configureForm();
      component['model'].update((model) => ({
        ...model,
        name: 'Courses Migros',
        money: { ...model.money, amount: 45.5 },
        kind: 'expense',
      }));

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Courses Migros',
          amount: 45.5,
          kind: 'expense',
          category: null,
        }),
      );
    });

    it('does not emit when the form is invalid', async () => {
      const { component, createdSpy } = configureForm();
      component['model'].update((model) => ({
        ...model,
        name: '',
        money: { ...model.money, amount: null },
      }));

      await component.submit();

      expect(createdSpy).not.toHaveBeenCalled();
    });

    it('converts an empty category to null', async () => {
      const { component, createdSpy } = configureForm();
      component['model'].update((model) => ({
        ...model,
        name: 'Test',
        money: { ...model.money, amount: 10 },
        category: '',
      }));

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({ category: null }),
      );
    });

    it('reports a conversion error without emitting', async () => {
      const { component, createdSpy, converter } = configureForm();
      converter.convertWithMetadata.mockRejectedValueOnce(
        new Error('rate unavailable'),
      );
      component['model'].update((model) => ({
        ...model,
        name: 'Test',
        money: { amount: 100, inputCurrency: 'CHF' },
      }));

      await component.submit();

      expect(createdSpy).not.toHaveBeenCalled();
      expect(component['conversionError']()).toBe(true);
    });
  });

  describe('checked toggle', () => {
    it('emits the checked state when the transaction is checked', async () => {
      const { component, createdSpy } = configureForm();
      component['model'].update((model) => ({
        ...model,
        name: 'Test',
        money: { ...model.money, amount: 10 },
        isChecked: true,
      }));

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isChecked: true }),
      );
    });

    it('emits the checked state when the transaction is unchecked', async () => {
      const { component, createdSpy } = configureForm();
      component['model'].update((model) => ({
        ...model,
        name: 'Test',
        money: { ...model.money, amount: 10 },
        isChecked: false,
      }));

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isChecked: false }),
      );
    });
  });

  describe('validation', () => {
    it('requires a name', () => {
      const { component } = configureForm();
      component['model'].update((model) => ({ ...model, name: '' }));

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((error) => error.kind === 'required'),
      ).toBe(true);
    });

    it('rejects an amount below the minimum', () => {
      const { component } = configureForm();
      component['model'].update((model) => ({
        ...model,
        money: { ...model.money, amount: 0 },
      }));

      expect(
        component['transactionForm'].money
          .amount()
          .errors()
          .some((error) => error.kind === 'min'),
      ).toBe(true);
    });
  });

  describe('currency rules', () => {
    it('initializes the amount with the user currency', () => {
      const { component } = configureForm({ userCurrency: 'EUR' });

      expect(component['model']().money).toEqual({
        amount: null,
        inputCurrency: 'EUR',
      });
    });

    it('emits the converted amount and metadata', async () => {
      const { component, createdSpy, converter } = configureForm({
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
      component['model'].update((model) => ({
        ...model,
        name: 'Test',
        money: { amount: 100, inputCurrency: 'EUR' },
      }));

      await component.submit();

      expect(converter.convertWithMetadata).toHaveBeenCalledWith(
        100,
        'EUR',
        'CHF',
      );
      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 108.97,
          conversion: {
            originalAmount: 100,
            originalCurrency: 'EUR',
            targetCurrency: 'CHF',
            exchangeRate: 1.0897,
          },
        }),
      );
    });
  });
});
