import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { form } from '@angular/forms/signals';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import {
  applyAmountValidators,
  CurrencyConverterService,
  createAmountSlice,
  type AmountFormSlice,
} from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import type { SupportedCurrency } from 'pulpe-shared';

import { AmountInput } from './amount-input';

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

function configure({
  userCurrency,
  flagEnabled,
  showCurrencyPref = true,
  initialAmount = null,
  initialCurrency,
}: {
  userCurrency: SupportedCurrency;
  flagEnabled: boolean;
  showCurrencyPref?: boolean;
  initialAmount?: number | null;
  initialCurrency?: SupportedCurrency;
}) {
  const flags: FlagsMock = {
    isMultiCurrencyEnabled: signal(flagEnabled),
  };
  const settings: SettingsMock = {
    currency: signal<SupportedCurrency>(userCurrency),
    showCurrencySelector: signal(showCurrencyPref),
  };
  const converter: ConverterMock = {
    convertWithMetadata: vi.fn().mockResolvedValue({
      convertedAmount: 0,
      metadata: null,
    }),
    fetchRate: vi.fn().mockResolvedValue({ rate: 1 }),
    convert: vi.fn((amount: number) => amount),
  };

  TestBed.configureTestingModule({
    imports: [AmountInput],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      ...provideTranslocoForTest(),
      { provide: FeatureFlagsService, useValue: flags },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const model = signal<AmountFormSlice>(
    createAmountSlice({
      initialCurrency: initialCurrency ?? userCurrency,
      initialAmount,
    }),
  );
  const testForm = TestBed.runInInjectionContext(() =>
    form(model, (path) => applyAmountValidators(path)),
  );

  const fixture = TestBed.createComponent(AmountInput);
  const component = fixture.componentInstance;
  setTestInput(component.control, testForm);
  fixture.detectChanges();

  return { fixture, component, model, testForm, flags, settings, converter };
}

describe('AmountInput', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders mat-label and amount input', () => {
    const { fixture } = configure({ userCurrency: 'CHF', flagEnabled: false });

    const input = fixture.nativeElement.querySelector(
      '[data-testid="amount-input-value"]',
    );
    expect(input).toBeTruthy();
    expect(input.getAttribute('type')).toBe('number');
  });

  it('exposes required + min(0.01) errors via field state', () => {
    const { fixture, model, testForm } = configure({
      userCurrency: 'CHF',
      flagEnabled: false,
    });

    expect(testForm.amount().value()).toBeNull();
    expect(testForm.amount().invalid()).toBe(true);

    model.update((m) => ({ ...m, amount: 0 }));
    fixture.detectChanges();

    expect(testForm.amount().invalid()).toBe(true);
    expect(
      testForm
        .amount()
        .errors()
        .some((e) => e.kind === 'min'),
    ).toBe(true);
  });

  it('hides currency picker when MULTI_CURRENCY flag is OFF (any mode)', () => {
    const { component } = configure({
      userCurrency: 'CHF',
      flagEnabled: false,
      showCurrencyPref: true,
    });

    expect(component['showSelector']()).toBe(false);
  });

  it('hides currency picker in mode=create when showCurrencySelector pref is OFF (flag ON)', () => {
    const { component } = configure({
      userCurrency: 'CHF',
      flagEnabled: true,
      showCurrencyPref: false,
    });

    expect(component['showSelector']()).toBe(false);
  });

  it('shows currency picker in mode=edit when originalCurrency differs from user currency', () => {
    const { fixture, component } = configure({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(component.mode, 'edit');
    setTestInput(component.originalCurrency, 'EUR');
    fixture.detectChanges();

    expect(component['showSelector']()).toBe(true);
  });

  it('hides currency picker in mode=edit when originalCurrency equals user currency', () => {
    const { fixture, component } = configure({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(component.mode, 'edit');
    setTestInput(component.originalCurrency, 'CHF');
    fixture.detectChanges();

    expect(component['showSelector']()).toBe(false);
  });

  it('reports pickerDisabled=true in mode=edit', () => {
    const { fixture, component } = configure({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(component.mode, 'edit');
    setTestInput(component.originalCurrency, 'EUR');
    fixture.detectChanges();

    expect(component['pickerDisabled']()).toBe(true);
  });

  it('writes inputCurrency to field when setInputCurrency is called', () => {
    const { fixture, component, model, testForm } = configure({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    component['setInputCurrency']('EUR');
    fixture.detectChanges();

    expect(testForm.inputCurrency().value()).toBe('EUR');
    expect(model().inputCurrency).toBe('EUR');
  });
});
