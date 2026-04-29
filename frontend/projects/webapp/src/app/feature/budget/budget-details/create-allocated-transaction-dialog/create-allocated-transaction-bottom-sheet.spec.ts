import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import type { SupportedCurrency } from 'pulpe-shared';
import { CreateAllocatedTransactionBottomSheet } from './create-allocated-transaction-bottom-sheet';
import type { CreateAllocatedTransactionDialogData } from './create-allocated-transaction-dialog';

const TEST_BUDGET_LINE_ID = '11111111-1111-4111-8111-111111111111';
const TEST_BUDGET_ID = '22222222-2222-4222-8222-222222222222';

const createDialogData = (
  overrides: Partial<CreateAllocatedTransactionDialogData['budgetLine']> = {},
): CreateAllocatedTransactionDialogData => ({
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
  } as CreateAllocatedTransactionDialogData['budgetLine'],
  budgetMonth: new Date().getMonth() + 1,
  budgetYear: new Date().getFullYear(),
  payDayOfMonth: null,
});

describe('CreateAllocatedTransactionBottomSheet', () => {
  let component: CreateAllocatedTransactionBottomSheet;
  let mockBottomSheetRef: { dismiss: ReturnType<typeof vi.fn> };
  let dialogData: CreateAllocatedTransactionDialogData;

  beforeEach(async () => {
    mockBottomSheetRef = { dismiss: vi.fn() };
    dialogData = createDialogData();

    await TestBed.configureTestingModule({
      imports: [CreateAllocatedTransactionBottomSheet],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideNativeDateAdapter(),
        ...provideTranslocoForTest(),
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: dialogData },
        { provide: MatBottomSheetRef, useValue: mockBottomSheetRef },
        {
          provide: CurrencyConverterService,
          useValue: {
            convertWithMetadata: vi
              .fn()
              .mockImplementation(async (amount: number) => ({
                convertedAmount: amount,
                metadata: null,
              })),
          },
        },
      ],
    }).compileComponents();

    component = TestBed.createComponent(
      CreateAllocatedTransactionBottomSheet,
    ).componentInstance;
  });

  describe('submit', () => {
    it('should dismiss with transaction data when form is valid', async () => {
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

      await component['submit']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
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

    it('should not dismiss when form is invalid', async () => {
      component['model'].update((m) => ({
        ...m,
        name: '',
        money: { ...m.money, amount: null },
      }));

      await component['submit']();

      expect(mockBottomSheetRef.dismiss).not.toHaveBeenCalled();
    });

    it('should trim whitespace from name', async () => {
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

      await component['submit']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Courses' }),
      );
    });

    it('should apply Math.abs on amount', async () => {
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

      await component['submit']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 42.5 }),
      );
    });
  });

  describe('checked toggle', () => {
    it('should set checkedAt to null by default (isChecked defaults to false)', async () => {
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

      await component['submit']();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ checkedAt: null }),
      );
    });

    it('should set checkedAt to ISO string when isChecked is true', async () => {
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

      await component['submit']();

      const callArg = mockBottomSheetRef.dismiss.mock.calls[0][0];
      expect(callArg.checkedAt).toBeDefined();
      expect(typeof callArg.checkedAt).toBe('string');
      expect(() => new Date(callArg.checkedAt!)).not.toThrow();
    });

    it('should set checkedAt to null when isChecked is false', async () => {
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
        isChecked: false,
      }));

      await component['submit']();

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
      component['model'].update((m) => ({ ...m, name: '' }));

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((e) => e.kind === 'required'),
      ).toBe(true);
    });

    it('should enforce max length on name', () => {
      component['model'].update((m) => ({ ...m, name: 'a'.repeat(101) }));

      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((e) => e.kind === 'maxLength'),
      ).toBe(true);
    });

    it('should require amount', () => {
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
    it('should set minDate and maxDate for current month budget', () => {
      expect(component['minDate']).toBeDefined();
      expect(component['maxDate']).toBeDefined();
      expect(component['minDate']!.getTime()).toBeLessThanOrEqual(
        component['maxDate']!.getTime(),
      );
    });

    it('should set minDate and maxDate for past month budget', async () => {
      const pastData: CreateAllocatedTransactionDialogData = {
        ...createDialogData(),
        budgetMonth: 1,
        budgetYear: 2020,
      };

      const pastRef = { dismiss: vi.fn() };

      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [CreateAllocatedTransactionBottomSheet],
          providers: [
            provideZonelessChangeDetection(),
            provideAnimationsAsync(),
            provideNativeDateAdapter(),
            ...provideTranslocoForTest(),
            { provide: MAT_BOTTOM_SHEET_DATA, useValue: pastData },
            { provide: MatBottomSheetRef, useValue: pastRef },
          ],
        })
        .compileComponents();

      const pastComponent = TestBed.createComponent(
        CreateAllocatedTransactionBottomSheet,
      ).componentInstance;

      expect(pastComponent['minDate']).toBeDefined();
      expect(pastComponent['maxDate']).toBeDefined();
      expect(pastComponent['minDate']!.getMonth()).toBe(0);
      expect(pastComponent['minDate']!.getFullYear()).toBe(2020);
    });

    it('should respect custom payDayOfMonth', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 27));

      const customPayDayData: CreateAllocatedTransactionDialogData = {
        ...createDialogData(),
        budgetMonth: 7,
        budgetYear: 2025,
        payDayOfMonth: 25,
      };

      const customRef = { dismiss: vi.fn() };

      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [CreateAllocatedTransactionBottomSheet],
          providers: [
            provideZonelessChangeDetection(),
            provideAnimationsAsync(),
            provideNativeDateAdapter(),
            ...provideTranslocoForTest(),
            { provide: MAT_BOTTOM_SHEET_DATA, useValue: customPayDayData },
            { provide: MatBottomSheetRef, useValue: customRef },
          ],
        })
        .compileComponents();

      const customComponent = TestBed.createComponent(
        CreateAllocatedTransactionBottomSheet,
      ).componentInstance;

      expect(customComponent['minDate']).toBeDefined();
      expect(customComponent['maxDate']).toBeDefined();
      expect(customComponent['minDate']!.getDate()).toBe(25);
      expect(customComponent['maxDate']!.getDate()).toBe(24);

      vi.useRealTimers();
    });
  });
});

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
}

function configureBottomSheetWithCurrency({
  userCurrency,
  flagEnabled,
  showCurrencyPref = true,
}: {
  userCurrency: SupportedCurrency;
  flagEnabled: boolean;
  showCurrencyPref?: boolean;
}) {
  const bottomSheetRef: BottomSheetRefMock = { dismiss: vi.fn() };
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
  };

  TestBed.configureTestingModule({
    imports: [CreateAllocatedTransactionBottomSheet],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      provideNativeDateAdapter(),
      ...provideTranslocoForTest(),
      { provide: MAT_BOTTOM_SHEET_DATA, useValue: createDialogData() },
      { provide: MatBottomSheetRef, useValue: bottomSheetRef },
      { provide: FeatureFlagsService, useValue: flags },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const fixture = TestBed.createComponent(
    CreateAllocatedTransactionBottomSheet,
  );
  const component = fixture.componentInstance;
  return { fixture, component, bottomSheetRef, converter, settings, flags };
}

describe('CreateAllocatedTransactionBottomSheet — currency create rules', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should initialize money slice with user currency', () => {
    const { component } = configureBottomSheetWithCurrency({
      userCurrency: 'EUR',
      flagEnabled: true,
    });

    expect(component['model']().money.inputCurrency).toBe('EUR');
  });

  it('should call convertWithMetadata and include metadata in payload when currencies differ', async () => {
    const { component, bottomSheetRef, converter } =
      configureBottomSheetWithCurrency({
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

    await component['submit']();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      100,
      'EUR',
      'CHF',
    );
    expect(bottomSheetRef.dismiss).toHaveBeenCalledTimes(1);
    const dto = bottomSheetRef.dismiss.mock.calls[0][0];
    expect(dto.amount).toBe(108.97);
    expect(dto.originalAmount).toBe(100);
    expect(dto.originalCurrency).toBe('EUR');
    expect(dto.targetCurrency).toBe('CHF');
    expect(dto.exchangeRate).toBe(1.0897);
  });

  it('should block submit and set conversionError when convertWithMetadata throws', async () => {
    const { component, bottomSheetRef, converter } =
      configureBottomSheetWithCurrency({
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

    await component['submit']();

    expect(bottomSheetRef.dismiss).not.toHaveBeenCalled();
    expect(component['conversionError']()).toBe(true);
  });

  it('should omit metadata fields from payload when inputCurrency equals userCurrency', async () => {
    const { component, bottomSheetRef, converter } =
      configureBottomSheetWithCurrency({
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

    await component['submit']();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      50,
      'CHF',
      'CHF',
    );
    expect(bottomSheetRef.dismiss).toHaveBeenCalledTimes(1);
    const dto = bottomSheetRef.dismiss.mock.calls[0][0];
    expect(dto.amount).toBe(50);
    expect(dto).not.toHaveProperty('originalAmount');
    expect(dto).not.toHaveProperty('originalCurrency');
    expect(dto).not.toHaveProperty('targetCurrency');
    expect(dto).not.toHaveProperty('exchangeRate');
  });
});
