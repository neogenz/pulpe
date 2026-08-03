import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupportedCurrency } from 'pulpe-shared';

import { of } from 'rxjs';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { createMockTagStore } from '@app/testing/tag-store.mock';
import { CurrencyConverterService } from '@core/currency';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { TagStore } from '@core/tag';
import { createMockDataCache } from '@core/testing';
import { UserSettingsStore } from '@core/user-settings';
import {
  AddTransactionForm,
  type TransactionFormData,
} from './add-transaction-form';

const GOAL_ID = '00000000-0000-4000-8000-0000000000a1';

interface SettingsMock {
  currency: ReturnType<typeof signal<SupportedCurrency>>;
  showCurrencySelector: ReturnType<typeof signal<boolean>>;
}

interface ConverterMock {
  convertWithMetadata: ReturnType<typeof vi.fn>;
}

function configureForm({
  userCurrency = 'CHF' as SupportedCurrency,
  showCurrencyPref = true,
}: {
  userCurrency?: SupportedCurrency;
  showCurrencyPref?: boolean;
} = {}) {
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

  const getWithdrawalOptions$ = vi.fn().mockReturnValue(
    of({
      success: true,
      data: [
        {
          goalId: GOAL_ID,
          name: 'Maison',
          status: 'ACTIVE',
          availableAmount: 10_000,
          currency: userCurrency,
        },
      ],
    }),
  );

  TestBed.configureTestingModule({
    imports: [AddTransactionForm],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      ...provideTranslocoForTest(),
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
      { provide: TagStore, useValue: createMockTagStore() },
      {
        provide: SavingsGoalApi,
        useValue: { cache: createMockDataCache(), getWithdrawalOptions$ },
      },
    ],
  });

  const fixture = TestBed.createComponent(AddTransactionForm);
  const component = fixture.componentInstance;
  const createdSpy = vi.fn<(tx: TransactionFormData) => void>();
  component.created.subscribe(createdSpy);

  return { fixture, component, createdSpy, converter, getWithdrawalOptions$ };
}

describe('AddTransactionForm', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('predefined amounts', () => {
    it('should render the four quick amounts as single-line 44px targets', async () => {
      const { fixture } = configureForm();
      await fixture.whenStable();

      const buttons = fixture.nativeElement.querySelectorAll(
        'button[matButton="tonal"]',
      );
      expect(buttons.length).toBe(4);
      expect(buttons[0].classList).toContain('min-h-11');
      expect(buttons[0].classList).toContain('whitespace-nowrap');
      expect(buttons[0].classList).toContain('px-2!');
    });

    it('should update and touch the amount field', () => {
      const { component } = configureForm();

      component['selectPredefinedAmount'](20);

      expect(component['transactionForm'].money.amount().value()).toBe(20);
      expect(component['transactionForm'].money.amount().touched()).toBe(true);
    });
  });

  describe('submit', () => {
    it('should emit transaction data when the form is valid', async () => {
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
          tagIds: [],
        }),
      );
    });

    it('should not emit when the form is invalid', async () => {
      const { component, createdSpy } = configureForm();
      component['model'].update((model) => ({
        ...model,
        name: '',
        money: { ...model.money, amount: null },
      }));

      await component.submit();

      expect(createdSpy).not.toHaveBeenCalled();
    });

    it('should emit the selected tag ids', async () => {
      const { component, createdSpy } = configureForm();
      const tagId = '00000000-0000-4000-8000-0000000000f1';
      component['model'].update((model) => ({
        ...model,
        name: 'Test',
        money: { ...model.money, amount: 10 },
        tagIds: [tagId],
      }));

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tagIds: [tagId] }),
      );
    });

    it('should report a conversion error without emitting', async () => {
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

  describe('savings-goal source (PUL-329)', () => {
    const enableIncomeFromGoal = async (
      component: AddTransactionForm,
      fixture: {
        detectChanges: () => void;
        whenStable: () => Promise<unknown>;
      },
      amount: number,
    ) => {
      component['model'].update((model) => ({
        ...model,
        name: 'Apport cuisine',
        money: { ...model.money, amount },
        kind: 'income',
      }));
      component['toggleSavingsGoalSource'](true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      component['sourceSavingsGoalId'].set(GOAL_ID);
      fixture.detectChanges();
      await fixture.whenStable();
    };

    it('should offer the option only for an income', async () => {
      const { component, fixture } = configureForm();
      await fixture.whenStable();

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="transaction-savings-source-toggle"]',
        ),
      ).toBeNull();

      component['model'].update((model) => ({ ...model, kind: 'income' }));
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="transaction-savings-source-toggle"]',
        ),
      ).not.toBeNull();
    });

    it('should emit the chosen goal with the income', async () => {
      const { component, fixture, createdSpy } = configureForm();
      await enableIncomeFromGoal(component, fixture, 4500);

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'income',
          sourceSavingsGoalId: GOAL_ID,
        }),
      );
    });

    it('should block the submission when the amount exceeds the balance', async () => {
      const { component, fixture } = configureForm();
      await enableIncomeFromGoal(component, fixture, 10_000.01);

      expect(component.canSubmit()).toBe(false);
    });

    it('should drop the origin without residue when the type leaves income', async () => {
      const { component, fixture, createdSpy } = configureForm();
      await enableIncomeFromGoal(component, fixture, 4500);

      component['model'].update((model) => ({ ...model, kind: 'expense' }));
      component['onKindChange']();
      fixture.detectChanges();
      component['model'].update((model) => ({ ...model, kind: 'income' }));
      component['onKindChange']();
      fixture.detectChanges();

      expect(component['sourceSavingsGoalId']()).toBeNull();
      expect(component['isFromSavingsGoal']()).toBe(false);

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sourceSavingsGoalId: null }),
      );
    });
  });

  describe('checked toggle', () => {
    it('should emit the checked state when the transaction is checked', async () => {
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

    it('should emit the checked state when the transaction is unchecked', async () => {
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
    it('should require a name', () => {
      const { component } = configureForm();
      component['model'].update((model) => ({ ...model, name: '' }));

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((error) => error.kind === 'required'),
      ).toBe(true);
    });

    it('should reject a whitespace-only name', async () => {
      const { component, createdSpy } = configureForm();
      component['model'].update((model) => ({
        ...model,
        name: '   ',
        money: { ...model.money, amount: 10 },
      }));

      await component.submit();

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((error) => error.kind === 'required'),
      ).toBe(true);
      expect(createdSpy).not.toHaveBeenCalled();
    });

    it('should reject a padded one-character name', async () => {
      const { component, createdSpy } = configureForm();
      component['model'].update((model) => ({
        ...model,
        name: ' A ',
        money: { ...model.money, amount: 10 },
      }));

      await component.submit();

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((error) => error.kind === 'minLength'),
      ).toBe(true);
      expect(createdSpy).not.toHaveBeenCalled();
    });

    it('should reject an amount below the minimum', () => {
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
    it('should initialize the amount with the user currency', () => {
      const { component } = configureForm({ userCurrency: 'EUR' });

      expect(component['model']().money).toEqual({
        amount: null,
        inputCurrency: 'EUR',
      });
    });

    it('should emit the converted amount and metadata', async () => {
      const { component, createdSpy, converter } = configureForm({
        userCurrency: 'CHF',
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
