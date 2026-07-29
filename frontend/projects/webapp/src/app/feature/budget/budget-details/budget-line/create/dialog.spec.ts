import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { TagStore } from '@core/tag';
import { createMockTagStore } from '@app/testing/tag-store.mock';
import type { SupportedCurrency } from 'pulpe-shared';
import { AddBudgetLineDialog, type BudgetLineDialogData } from './dialog';

const TAG_ID = '00000000-0000-4000-8000-0000000000f1';
const SAVINGS_GOAL_ID = '00000000-0000-4000-8000-0000000000f2';

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
  showCurrencyPref = true,
}: {
  userCurrency?: SupportedCurrency;
  showCurrencyPref?: boolean;
} = {}) {
  const dialogRef: DialogRefMock = { close: vi.fn() };
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
      provideHttpClient(),
      provideHttpClientTesting(),
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
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
      { provide: TagStore, useValue: createMockTagStore() },
    ],
  });

  const fixture = TestBed.createComponent(AddBudgetLineDialog);
  const component = fixture.componentInstance;
  return { fixture, component, dialogRef, converter, settings };
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

    it('should include selected tag ids in the single-line payload', async () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: 'Loyer',
        kind: 'expense',
        recurrence: 'fixed',
        tagIds: [TAG_ID],
        money: { amount: 1200, inputCurrency: 'CHF' },
      }));

      await component['handleSubmit']();

      expect(dialogRef.close).toHaveBeenCalledWith({
        mode: 'single',
        value: expect.objectContaining({ tagIds: [TAG_ID] }),
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

  describe('savings-goal link', () => {
    it('should keep the goal picker visible for a spread saving', () => {
      const { fixture, component } = configureDialog();
      component['model'].update((m) => ({ ...m, kind: 'saving' }));
      component['setMode']('spread');

      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('pulpe-savings-goal-picker-field'),
      ).not.toBeNull();
    });

    it('should clear the selected goal when kind stops being saving', () => {
      const { component } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        kind: 'saving',
        savingsGoalId: SAVINGS_GOAL_ID,
      }));

      component['onKindChange']('expense');

      expect(component['model']().savingsGoalId).toBeNull();
    });

    it('should submit the selected goal with a spread saving', async () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: 'Maison',
        kind: 'saving',
        savingsGoalId: SAVINGS_GOAL_ID,
        money: { amount: 600, inputCurrency: 'CHF' },
      }));
      component['setMode']('spread');

      await component['handleSubmit']();

      expect(dialogRef.close).toHaveBeenCalledWith({
        mode: 'spread',
        value: expect.objectContaining({ savingsGoalId: SAVINGS_GOAL_ID }),
      });
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

  describe('savings withdrawal shortcut (saving kind)', () => {
    it('should render the pioche button only for the saving kind', () => {
      const { fixture, component } = configureDialog();

      component['model'].update((m) => ({ ...m, kind: 'saving' }));
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="open-savings-withdrawal"]',
        ),
      ).not.toBeNull();

      component['model'].update((m) => ({ ...m, kind: 'expense' }));
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="open-savings-withdrawal"]',
        ),
      ).toBeNull();
    });

    it('should close with savingsWithdrawal mode and no prefill when no amount was typed', () => {
      const { component, dialogRef } = configureDialog();

      component['requestSavingsWithdrawal']();

      expect(dialogRef.close).toHaveBeenCalledWith({
        mode: 'savingsWithdrawal',
      });
    });

    it('should carry the typed amount, trimmed name and input currency as prefill', () => {
      const { component, dialogRef } = configureDialog();
      component['model'].update((m) => ({
        ...m,
        name: '  Vacances  ',
        kind: 'saving',
        money: { amount: 250, inputCurrency: 'CHF' },
      }));

      component['requestSavingsWithdrawal']();

      expect(dialogRef.close).toHaveBeenCalledWith({
        mode: 'savingsWithdrawal',
        prefill: { amount: 250, source: 'Vacances', inputCurrency: 'CHF' },
      });
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
