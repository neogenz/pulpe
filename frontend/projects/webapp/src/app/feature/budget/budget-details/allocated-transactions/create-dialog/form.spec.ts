import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import type { SupportedCurrency, TransactionCreate } from 'pulpe-shared';

import {
  CreateAllocatedTransactionForm,
  type CreateAllocatedTransactionFormData,
} from './form';

const TEST_BUDGET_LINE_ID = '11111111-1111-4111-8111-111111111111';
const TEST_BUDGET_ID = '22222222-2222-4222-8222-222222222222';

const createFormData = (
  overrides: Partial<CreateAllocatedTransactionFormData['budgetLine']> = {},
): CreateAllocatedTransactionFormData => ({
  budgetLine: {
    id: TEST_BUDGET_LINE_ID,
    budgetId: TEST_BUDGET_ID,
    name: 'Assurance maladie',
    amount: 385,
    kind: 'expense',
    frequency: 'monthly',
    savingsGoalId: null,
    isRollover: false,
    rolloverSourceBudgetId: undefined,
    ...overrides,
  } as CreateAllocatedTransactionFormData['budgetLine'],
  budgetMonth: new Date().getMonth() + 1,
  budgetYear: new Date().getFullYear(),
  payDayOfMonth: null,
});

interface SetupResult {
  fixture: ComponentFixture<CreateAllocatedTransactionForm>;
  component: CreateAllocatedTransactionForm;
  createdSpy: ReturnType<typeof vi.fn<(tx: TransactionCreate) => void>>;
}

const setupForm = (
  data: CreateAllocatedTransactionFormData = createFormData(),
  converter: { convertWithMetadata: ReturnType<typeof vi.fn> } = {
    convertWithMetadata: vi.fn().mockImplementation(async (amount: number) => ({
      convertedAmount: amount,
      metadata: null,
    })),
  },
): SetupResult => {
  TestBed.configureTestingModule({
    imports: [CreateAllocatedTransactionForm],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      provideNativeDateAdapter(),
      ...provideTranslocoForTest(),
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const fixture = TestBed.createComponent(CreateAllocatedTransactionForm);
  setTestInput(fixture.componentInstance.data, data);
  fixture.detectChanges();

  const createdSpy = vi.fn<(tx: TransactionCreate) => void>();
  fixture.componentInstance.created.subscribe(createdSpy);

  return { fixture, component: fixture.componentInstance, createdSpy };
};

const setupWithCurrency = ({
  userCurrency,
  flagEnabled,
  showCurrencyPref = true,
}: {
  userCurrency: SupportedCurrency;
  flagEnabled: boolean;
  showCurrencyPref?: boolean;
}) => {
  const flags = { isMultiCurrencyEnabled: signal(flagEnabled) };
  const settings = {
    currency: signal<SupportedCurrency>(userCurrency),
    showCurrencySelector: signal(showCurrencyPref),
  };
  const converter = {
    convertWithMetadata: vi.fn().mockResolvedValue({
      convertedAmount: 0,
      metadata: null,
    }),
  };

  TestBed.configureTestingModule({
    imports: [CreateAllocatedTransactionForm],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      provideNativeDateAdapter(),
      ...provideTranslocoForTest(),
      { provide: FeatureFlagsService, useValue: flags },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const fixture = TestBed.createComponent(CreateAllocatedTransactionForm);
  setTestInput(fixture.componentInstance.data, createFormData());
  fixture.detectChanges();

  const createdSpy = vi.fn<(tx: TransactionCreate) => void>();
  fixture.componentInstance.created.subscribe(createdSpy);

  return {
    fixture,
    component: fixture.componentInstance,
    createdSpy,
    converter,
    settings,
    flags,
  };
};

describe('CreateAllocatedTransactionForm', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('submit', () => {
    it('should emit created with transaction data when form is valid', async () => {
      const { component, createdSpy } = setupForm();
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component['model'].update((m) => ({
        ...m,
        name: 'Consultation médecin',
        money: { ...m.money, amount: 45.5 },
        transactionDate: midMonth,
      }));

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetId: TEST_BUDGET_ID,
          budgetLineId: TEST_BUDGET_LINE_ID,
          name: 'Consultation médecin',
          amount: 45.5,
          kind: 'expense',
          category: null,
        }),
      );
    });

    it('should not emit when form is invalid', async () => {
      const { component, createdSpy } = setupForm();
      component['model'].update((m) => ({
        ...m,
        name: '',
        money: { ...m.money, amount: null },
      }));

      await component.submit();

      expect(createdSpy).not.toHaveBeenCalled();
    });

    it('should trim whitespace from name', async () => {
      const { component, createdSpy } = setupForm();
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component['model'].update((m) => ({
        ...m,
        name: '  Courses  ',
        money: { ...m.money, amount: 20 },
        transactionDate: midMonth,
      }));

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Courses' }),
      );
    });

    it('should accept positive amount', async () => {
      const { component, createdSpy } = setupForm();
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { ...m.money, amount: 42.5 },
        transactionDate: midMonth,
      }));

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 42.5 }),
      );
    });
  });

  describe('checked toggle', () => {
    it('should set checkedAt to null by default', async () => {
      const { component, createdSpy } = setupForm();
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { ...m.money, amount: 10 },
        transactionDate: midMonth,
      }));

      await component.submit();

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({ checkedAt: null }),
      );
    });

    it('should set checkedAt to ISO string when isChecked is true', async () => {
      const { component, createdSpy } = setupForm();
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { ...m.money, amount: 10 },
        transactionDate: midMonth,
        isChecked: true,
      }));

      await component.submit();

      const callArg = createdSpy.mock.calls[0][0];
      expect(callArg.checkedAt).toBeDefined();
      expect(typeof callArg.checkedAt).toBe('string');
      expect(() => new Date(callArg.checkedAt!)).not.toThrow();
    });
  });

  describe('form validation', () => {
    it('should require name', () => {
      const { component } = setupForm();
      component['model'].update((m) => ({ ...m, name: '' }));

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((e) => e.kind === 'required'),
      ).toBe(true);
    });

    it('should enforce max length on name', () => {
      const { component } = setupForm();
      component['model'].update((m) => ({ ...m, name: 'a'.repeat(101) }));

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((e) => e.kind === 'maxLength'),
      ).toBe(true);
    });

    it('should require amount', () => {
      const { component } = setupForm();
      component['model'].update((m) => ({
        ...m,
        money: { ...m.money, amount: null },
      }));

      expect(
        component['transactionForm'].money
          .amount()
          .errors()
          .some((e) => e.kind === 'required'),
      ).toBe(true);
    });

    it('should reject amount below 0.01', () => {
      const { component } = setupForm();
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
      const { component } = setupForm();
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

    it('should require transaction date', () => {
      const { component } = setupForm();
      component['model'].update((m) => ({
        ...m,
        transactionDate: null as unknown as Date,
      }));

      expect(
        component['transactionForm']
          .transactionDate()
          .errors()
          .some((e) => e.kind === 'required'),
      ).toBe(true);
    });
  });

  describe('date constraints', () => {
    it('should expose minDate and maxDate computed from data', () => {
      const { component } = setupForm();
      expect(component['minDate']()).toBeDefined();
      expect(component['maxDate']()).toBeDefined();
      expect(component['minDate']().getTime()).toBeLessThanOrEqual(
        component['maxDate']().getTime(),
      );
    });

    it('should use the past month boundaries when budget is in the past', () => {
      const { component } = setupForm({
        ...createFormData(),
        budgetMonth: 1,
        budgetYear: 2020,
      } as CreateAllocatedTransactionFormData);

      expect(component['minDate']().getMonth()).toBe(0);
      expect(component['minDate']().getFullYear()).toBe(2020);
    });

    it('should respect custom payDayOfMonth', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 27));

      const { component } = setupForm({
        ...createFormData(),
        budgetMonth: 7,
        budgetYear: 2025,
        payDayOfMonth: 25,
      } as CreateAllocatedTransactionFormData);

      expect(component['minDate']().getDate()).toBe(25);
      expect(component['maxDate']().getDate()).toBe(24);

      vi.useRealTimers();
    });
  });
});

describe('CreateAllocatedTransactionForm — currency create rules', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should initialize money slice with user currency', () => {
    const { component } = setupWithCurrency({
      userCurrency: 'EUR',
      flagEnabled: true,
    });

    expect(component['model']().money.inputCurrency).toBe('EUR');
  });

  it('should call convertWithMetadata and include metadata in payload when currencies differ', async () => {
    const { component, createdSpy, converter } = setupWithCurrency({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 108.97,
      metadata: {
        originalAmount: 100,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 1.0897,
      },
    });

    const midMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      15,
    );
    component['model'].update((m) => ({
      ...m,
      name: 'Charges',
      money: { amount: 100, inputCurrency: 'EUR' },
      transactionDate: midMonth,
    }));

    await component.submit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      100,
      'EUR',
      'CHF',
    );
    expect(createdSpy).toHaveBeenCalledTimes(1);
    const dto = createdSpy.mock.calls[0][0];
    expect(dto.amount).toBe(108.97);
    expect(dto.originalAmount).toBe(100);
    expect(dto.originalCurrency).toBe('EUR');
    expect(dto.targetCurrency).toBe('CHF');
    expect(dto.exchangeRate).toBe(1.0897);
  });

  it('should block submit and set conversionError when convertWithMetadata throws', async () => {
    const { component, createdSpy, converter } = setupWithCurrency({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockRejectedValue(new Error('rate down'));
    const midMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      15,
    );
    component['model'].update((m) => ({
      ...m,
      name: 'Charges',
      money: { amount: 100, inputCurrency: 'EUR' },
      transactionDate: midMonth,
    }));

    await component.submit();

    expect(createdSpy).not.toHaveBeenCalled();
    expect(component['conversionError']()).toBe(true);
  });

  it('should omit metadata fields from payload when inputCurrency equals userCurrency', async () => {
    const { component, createdSpy, converter } = setupWithCurrency({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 50,
      metadata: null,
    });

    const midMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      15,
    );
    component['model'].update((m) => ({
      ...m,
      name: 'Charges',
      money: { amount: 50, inputCurrency: 'CHF' },
      transactionDate: midMonth,
    }));

    await component.submit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      50,
      'CHF',
      'CHF',
    );
    expect(createdSpy).toHaveBeenCalledTimes(1);
    const dto = createdSpy.mock.calls[0][0];
    expect(dto.amount).toBe(50);
    expect(dto).not.toHaveProperty('originalAmount');
    expect(dto).not.toHaveProperty('originalCurrency');
    expect(dto).not.toHaveProperty('targetCurrency');
    expect(dto).not.toHaveProperty('exchangeRate');
  });
});
