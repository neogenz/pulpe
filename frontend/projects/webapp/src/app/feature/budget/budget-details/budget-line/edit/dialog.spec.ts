import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { createMockBudgetLine } from '@app/testing/mock-factories';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import type { BudgetLine, SupportedCurrency } from 'pulpe-shared';
import { EditBudgetLineDialog, type EditBudgetLineDialogData } from './dialog';

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
interface DialogRefMock {
  close: ReturnType<typeof vi.fn>;
}

function configureDialog(
  budgetLine: BudgetLine,
  {
    userCurrency,
    flagEnabled,
  }: { userCurrency: SupportedCurrency; flagEnabled: boolean },
) {
  const dialogRef: DialogRefMock = { close: vi.fn() };
  const flags: FlagsMock = {
    isMultiCurrencyEnabled: signal(flagEnabled),
  };
  const settings: SettingsMock = {
    currency: signal<SupportedCurrency>(userCurrency),
    showCurrencySelector: signal(true),
  };
  const converter: ConverterMock = {
    convertWithMetadata: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [EditBudgetLineDialog, MatDialogModule, NoopAnimationsModule],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { budgetLine } satisfies EditBudgetLineDialogData,
      },
      { provide: FeatureFlagsService, useValue: flags },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const fixture = TestBed.createComponent(EditBudgetLineDialog);
  const component = fixture.componentInstance;
  return { fixture, component, dialogRef, converter };
}

describe('EditBudgetLineDialog — currency edit rules', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows disabled picker and pre-fills originalAmount when line.originalCurrency differs from user currency (flag ON)', () => {
    const line = createMockBudgetLine({
      amount: 120,
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 1.2,
    });

    const { component } = configureDialog(line, {
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    expect(component['showCurrencySelector']()).toBe(true);
    expect(component['model']().money.amount).toBe(100);
  });

  it('hides picker and uses line.amount when originalCurrency equals user currency', () => {
    const line = createMockBudgetLine({
      amount: 500,
      originalAmount: 500,
      originalCurrency: 'CHF',
      targetCurrency: 'CHF',
      exchangeRate: 1,
    });

    const { component } = configureDialog(line, {
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    expect(component['showCurrencySelector']()).toBe(false);
    expect(component['model']().money.amount).toBe(500);
  });

  it('hides picker on mono-currency lines (no originalCurrency)', () => {
    const line = createMockBudgetLine({ amount: 200 });

    const { component } = configureDialog(line, {
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    expect(component['showCurrencySelector']()).toBe(false);
    expect(component['model']().money.amount).toBe(200);
  });

  it('hides picker when feature flag is OFF, even if originalCurrency differs', () => {
    const line = createMockBudgetLine({
      amount: 120,
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 1.2,
    });

    const { component } = configureDialog(line, {
      userCurrency: 'CHF',
      flagEnabled: false,
    });

    expect(component['showCurrencySelector']()).toBe(false);
    expect(component['model']().money.amount).toBe(120);
  });

  it('on submit (mono-currency edit), PATCH does not include currency metadata (converter short-circuits same currency)', async () => {
    const line = createMockBudgetLine({ amount: 200 });

    const { component, dialogRef, converter } = configureDialog(line, {
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 250,
      metadata: null,
    });

    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 250 },
      name: 'Updated',
    }));

    await component.handleSubmit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      250,
      'CHF',
      'CHF',
    );
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const patch = dialogRef.close.mock.calls[0][0];
    expect(patch.amount).toBe(250);
    expect(patch).not.toHaveProperty('originalAmount');
    expect(patch).not.toHaveProperty('originalCurrency');
    expect(patch).not.toHaveProperty('targetCurrency');
    expect(patch).not.toHaveProperty('exchangeRate');
  });

  it('on submit (alternate currency edit), converter is called with (amount, EUR, CHF) and PATCH includes fresh metadata', async () => {
    const line = createMockBudgetLine({
      amount: 120,
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 1.2,
    });

    const { component, dialogRef, converter } = configureDialog(line, {
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
      money: { ...m.money, amount: 150 },
    }));

    await component.handleSubmit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      150,
      'EUR',
      'CHF',
    );
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const patch = dialogRef.close.mock.calls[0][0];
    expect(patch.amount).toBe(180);
    expect(patch.originalAmount).toBe(150);
    expect(patch.originalCurrency).toBe('EUR');
    expect(patch.targetCurrency).toBe('CHF');
    expect(patch.exchangeRate).toBe(1.2);
  });

  it('blocks submit and sets conversionError when convertWithMetadata throws on alternate-currency edit', async () => {
    const line = createMockBudgetLine({
      amount: 120,
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 1.2,
    });

    const { component, dialogRef, converter } = configureDialog(line, {
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockRejectedValue(new Error('rate down'));

    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 150 },
    }));

    await component.handleSubmit();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component['conversionError']()).toBe(true);
  });

  it('originalCurrency falls back to null when budget line has no originalCurrency', () => {
    const line = createMockBudgetLine({ amount: 200 });

    const { component } = configureDialog(line, {
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    expect(component['originalCurrency']).toBe(null);
  });
});
