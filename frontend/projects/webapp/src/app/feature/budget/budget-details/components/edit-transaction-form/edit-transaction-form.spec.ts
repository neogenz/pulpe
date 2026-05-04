import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { EditTransactionForm } from './edit-transaction-form';
import { type TransactionUpdate } from 'pulpe-shared';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import type { SupportedCurrency, Transaction } from 'pulpe-shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('EditTransactionForm', () => {
  let component: EditTransactionForm;
  let fixture: ComponentFixture<EditTransactionForm>;

  beforeEach(async () => {
    const converter = {
      convertWithMetadata: vi.fn().mockResolvedValue({
        convertedAmount: 0,
        metadata: null,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [EditTransactionForm],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        provideAnimationsAsync(),
        provideNativeDateAdapter(),
        { provide: CurrencyConverterService, useValue: converter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditTransactionForm);
    component = fixture.componentInstance;
    setTestInput(component.transaction, makeTransaction());
    fixture.detectChanges();
  });

  describe('Component Structure', () => {
    it('should have required properties defined', () => {
      expect(component.transaction).toBeDefined();
      expect(typeof component.transaction).toBe('function');

      expect(component.updateTransaction).toBeDefined();
      expect(typeof component.updateTransaction.emit).toBe('function');
      expect(component.cancelEdit).toBeDefined();
      expect(typeof component.cancelEdit.emit).toBe('function');

      expect(component.isUpdating).toBeDefined();
      expect(typeof component.isUpdating).toBe('function');
      expect(component.isUpdating()).toBe(false);
    });

    it('should expose transactionForm signal-form', () => {
      const tf = component['transactionForm'];
      expect(tf).toBeDefined();
      expect(tf.name).toBeDefined();
      expect(tf.money).toBeDefined();
      expect(tf.kind).toBeDefined();
      expect(tf.transactionDate).toBeDefined();
      expect(tf.category).toBeDefined();
    });

    it('should have proper field validators', () => {
      component['model'].update((m) => ({ ...m, name: '' }));
      expect(
        component['transactionForm']
          .name()
          .errors()
          .some((e) => e.kind === 'required'),
      ).toBe(true);

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

      component['model'].update((m) => ({
        ...m,
        money: { ...m.money, amount: 0.01 },
      }));
      expect(
        component['transactionForm'].money
          .amount()
          .errors()
          .some((e) => e.kind === 'min'),
      ).toBe(false);

      component['model'].update((m) => ({ ...m, kind: null! }));
      expect(
        component['transactionForm']
          .kind()
          .errors()
          .some((e) => e.kind === 'required'),
      ).toBe(true);

      component['model'].update((m) => ({ ...m, transactionDate: null! }));
      expect(
        component['transactionForm']
          .transactionDate()
          .errors()
          .some((e) => e.kind === 'required'),
      ).toBe(true);
    });
  });

  describe('Form Initialization', () => {
    it('should initialize model with transaction data', () => {
      const tx = makeTransaction({
        name: 'Loyer',
        amount: 1200,
        kind: 'expense',
      });
      setTestInput(component.transaction, tx);
      fixture.detectChanges();

      expect(component['model']().name).toBe('Loyer');
      expect(component['model']().money.amount).toBe(1200);
      expect(component['model']().kind).toBe('expense');
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      setTestInput(component.transaction, makeTransaction({ amount: 10 }));
      fixture.detectChanges();
    });

    it('should set loading state during submit and reset after', async () => {
      const converter = TestBed.inject(CurrencyConverterService) as unknown as {
        convertWithMetadata: ReturnType<typeof vi.fn>;
      };
      let resolveConvert: (value: {
        convertedAmount: number;
        metadata: null;
      }) => void;
      converter.convertWithMetadata.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveConvert = resolve;
        }),
      );

      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { ...m.money, amount: 100 },
        kind: 'expense',
        transactionDate: new Date(),
        category: 'Test Category',
      }));

      expect(component.isUpdating()).toBe(false);

      const submitPromise = component.onSubmit();

      expect(component.isUpdating()).toBe(true);

      resolveConvert!({ convertedAmount: 100, metadata: null });
      await submitPromise;

      expect(component.isUpdating()).toBe(false);
    });

    it('should not submit when form is invalid', async () => {
      component['model'].update((m) => ({
        ...m,
        name: '',
        money: { ...m.money, amount: null },
      }));

      const initialLoadingState = component.isUpdating();
      await component.onSubmit();

      expect(component.isUpdating()).toBe(initialLoadingState);
    });

    it('should not submit when already updating', async () => {
      const converter = TestBed.inject(CurrencyConverterService) as unknown as {
        convertWithMetadata: ReturnType<typeof vi.fn>;
      };
      let resolveConvert: (value: {
        convertedAmount: number;
        metadata: null;
      }) => void;
      converter.convertWithMetadata.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveConvert = resolve;
        }),
      );

      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { ...m.money, amount: 100 },
        kind: 'expense',
        transactionDate: new Date(),
        category: 'Test',
      }));

      const submitPromise = component.onSubmit();
      expect(component.isUpdating()).toBe(true);

      await component.onSubmit();

      expect(converter.convertWithMetadata).toHaveBeenCalledTimes(1);

      resolveConvert!({ convertedAmount: 100, metadata: null });
      await submitPromise;
    });
  });

  describe('Date Constraints', () => {
    beforeEach(() => {
      setTestInput(component.transaction, makeTransaction());
      fixture.detectChanges();
    });

    it('should default to current month bounds', () => {
      const now = new Date();
      component['model'].update((m) => ({ ...m, transactionDate: now }));

      expect(
        component['transactionForm']
          .transactionDate()
          .errors()
          .some((e) => e.kind === 'dateOutOfRange'),
      ).toBe(false);
    });

    it('should reject dates outside current month when no custom bounds', () => {
      const lastYear = new Date(new Date().getFullYear() - 1, 0, 15);
      component['model'].update((m) => ({ ...m, transactionDate: lastYear }));

      expect(
        component['transactionForm']
          .transactionDate()
          .errors()
          .some((e) => e.kind === 'dateOutOfRange'),
      ).toBe(true);
    });

    it('should validate against custom min/max when signal inputs are provided', () => {
      const customMin = new Date(2024, 0, 1);
      const customMax = new Date(2024, 0, 31);

      setTestInput(component.minDateInput, customMin);
      setTestInput(component.maxDateInput, customMax);

      component['model'].update((m) => ({
        ...m,
        transactionDate: new Date(2024, 0, 15),
      }));
      expect(
        component['transactionForm']
          .transactionDate()
          .errors()
          .some((e) => e.kind === 'dateOutOfRange'),
      ).toBe(false);

      component['model'].update((m) => ({
        ...m,
        transactionDate: new Date(2024, 5, 15),
      }));
      expect(
        component['transactionForm']
          .transactionDate()
          .errors()
          .some((e) => e.kind === 'dateOutOfRange'),
      ).toBe(true);
    });

    it('should re-validate when bounds change (signal-forms tracks signals natively)', () => {
      setTestInput(component.minDateInput, new Date(2024, 0, 1));
      setTestInput(component.maxDateInput, new Date(2024, 0, 31));

      component['model'].update((m) => ({
        ...m,
        transactionDate: new Date(2024, 0, 15),
      }));
      expect(
        component['transactionForm']
          .transactionDate()
          .errors()
          .some((e) => e.kind === 'dateOutOfRange'),
      ).toBe(false);

      setTestInput(component.minDateInput, new Date(2024, 1, 1));
      setTestInput(component.maxDateInput, new Date(2024, 1, 29));

      expect(
        component['transactionForm']
          .transactionDate()
          .errors()
          .some((e) => e.kind === 'dateOutOfRange'),
      ).toBe(true);
    });
  });

  describe('hiddenFields', () => {
    it('should default to empty array (no hidden fields)', () => {
      expect(component.hiddenFields()).toEqual([]);
      expect(component['isFieldHidden']('kind')).toBe(false);
      expect(component['isFieldHidden']('category')).toBe(false);
    });

    it('should still emit original values for hidden fields on submit', async () => {
      const converter = TestBed.inject(CurrencyConverterService) as unknown as {
        convertWithMetadata: ReturnType<typeof vi.fn>;
      };
      converter.convertWithMetadata.mockResolvedValue({
        convertedAmount: 100,
        metadata: null,
      });

      setTestInput(component.transaction, makeTransaction({ amount: 10 }));
      fixture.detectChanges();

      component['model'].update((m) => ({
        ...m,
        name: 'Test',
        money: { ...m.money, amount: 100 },
        kind: 'expense',
        transactionDate: new Date(),
        category: 'Notes',
      }));

      let emittedData: TransactionUpdate | undefined;
      component.updateTransaction.subscribe((data) => {
        emittedData = data;
      });

      await component.onSubmit();

      expect(emittedData).toBeDefined();
      expect(emittedData!.kind).toBe('expense');
      expect(emittedData!.category).toBe('Notes');
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

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    budgetId: 'b-1',
    budgetLineId: null,
    name: 'Loyer',
    amount: 1200,
    kind: 'expense',
    transactionDate: new Date().toISOString(),
    category: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checkedAt: null,
    ...overrides,
  } as Transaction;
}

function configureForm({
  userCurrency,
  flagEnabled,
}: {
  userCurrency: SupportedCurrency;
  flagEnabled: boolean;
}) {
  const flags: FlagsMock = {
    isMultiCurrencyEnabled: signal(flagEnabled),
  };
  const settings: SettingsMock = {
    currency: signal<SupportedCurrency>(userCurrency),
    showCurrencySelector: signal(true),
  };
  const converter: ConverterMock = {
    convertWithMetadata: vi.fn().mockResolvedValue({
      convertedAmount: 0,
      metadata: null,
    }),
  };

  TestBed.configureTestingModule({
    imports: [EditTransactionForm],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      provideAnimationsAsync(),
      provideNativeDateAdapter(),
      { provide: FeatureFlagsService, useValue: flags },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
    ],
  });

  const fixture = TestBed.createComponent(EditTransactionForm);
  const component = fixture.componentInstance;
  return { fixture, component, converter, settings, flags };
}

describe('EditTransactionForm — currency edit rules', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows picker when flag ON and originalCurrency differs from user currency', () => {
    const { fixture, component } = configureForm({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(
      component.transaction,
      makeTransaction({
        originalAmount: 100,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 1.2,
      }),
    );
    fixture.detectChanges();

    expect(component['showCurrencySelector']()).toBe(true);
  });

  it('hides picker when flag is OFF (even with alternate originalCurrency)', () => {
    const { fixture, component } = configureForm({
      userCurrency: 'CHF',
      flagEnabled: false,
    });

    setTestInput(
      component.transaction,
      makeTransaction({
        originalAmount: 100,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 1.2,
      }),
    );
    fixture.detectChanges();

    expect(component['showCurrencySelector']()).toBe(false);
  });

  it('hides picker when originalCurrency is null/undefined (mono-currency)', () => {
    const { fixture, component } = configureForm({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(component.transaction, makeTransaction({ amount: 200 }));
    fixture.detectChanges();

    expect(component['showCurrencySelector']()).toBe(false);
  });

  it('hides picker when originalCurrency equals user currency', () => {
    const { fixture, component } = configureForm({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(
      component.transaction,
      makeTransaction({
        originalAmount: 200,
        originalCurrency: 'CHF',
        targetCurrency: 'CHF',
        exchangeRate: 1,
      }),
    );
    fixture.detectChanges();

    expect(component['showCurrencySelector']()).toBe(false);
  });

  it('pre-fills form with originalAmount when picker is visible (alternate currency)', () => {
    const { fixture, component } = configureForm({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(
      component.transaction,
      makeTransaction({
        amount: 120,
        originalAmount: 100,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 1.2,
      }),
    );
    fixture.detectChanges();

    expect(component['model']().money.amount).toBe(100);
  });

  it('emits update with metadata when alternate-currency edit submits', async () => {
    const { fixture, component, converter } = configureForm({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(
      component.transaction,
      makeTransaction({
        amount: 120,
        originalAmount: 100,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 1.2,
      }),
    );
    fixture.detectChanges();

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

    let emitted: TransactionUpdate | undefined;
    component.updateTransaction.subscribe((d) => {
      emitted = d;
    });

    await component.onSubmit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      150,
      'EUR',
      'CHF',
    );
    expect(emitted).toBeDefined();
    expect(emitted!.amount).toBe(180);
    expect(emitted!.originalAmount).toBe(150);
    expect(emitted!.originalCurrency).toBe('EUR');
    expect(emitted!.targetCurrency).toBe('CHF');
    expect(emitted!.exchangeRate).toBe(1.2);
  });

  it('emits update with metadata=null when mono-currency edit submits (converter short-circuits)', async () => {
    const { fixture, component, converter } = configureForm({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(
      component.transaction,
      makeTransaction({ amount: 200, name: 'Loyer' }),
    );
    fixture.detectChanges();

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 250,
      metadata: null,
    });

    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 250 },
    }));

    let emitted: TransactionUpdate | undefined;
    component.updateTransaction.subscribe((d) => {
      emitted = d;
    });

    await component.onSubmit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      250,
      'CHF',
      'CHF',
    );
    expect(emitted).toBeDefined();
    expect(emitted!.amount).toBe(250);
    expect(emitted!.originalAmount).toBeUndefined();
    expect(emitted!.originalCurrency).toBeUndefined();
    expect(emitted!.targetCurrency).toBeUndefined();
    expect(emitted!.exchangeRate).toBeUndefined();
  });

  it('blocks submit and sets conversionError when convertWithMetadata throws on alternate-currency edit', async () => {
    const { fixture, component, converter } = configureForm({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(
      component.transaction,
      makeTransaction({
        amount: 120,
        originalAmount: 100,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 1.2,
      }),
    );
    fixture.detectChanges();

    converter.convertWithMetadata.mockRejectedValue(new Error('rate down'));
    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 150 },
    }));

    let emitted: TransactionUpdate | undefined;
    component.updateTransaction.subscribe((d) => {
      emitted = d;
    });

    await component.onSubmit();

    expect(emitted).toBeUndefined();
    expect(component['conversionError']()).toBe(true);
  });

  it('should NOT reset user-edited model fields when settings.currency() changes (linkedSignal regression — issue #1)', () => {
    const { fixture, component, settings } = configureForm({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    setTestInput(
      component.transaction,
      makeTransaction({
        name: 'Original Name',
        amount: 100,
        originalCurrency: 'EUR',
        originalAmount: 90,
      }),
    );
    fixture.detectChanges();

    // Verify initial name
    expect(component['model']().name).toBe('Original Name');

    // User edits the model — simulates typing in the name field
    component['model'].update((m) => ({ ...m, name: 'User Edit' }));
    expect(component['model']().name).toBe('User Edit');

    // Settings currency flips — pre-fix bug: linkedSignal computation re-runs and wipes 'User Edit'
    settings.currency.set('EUR');
    fixture.detectChanges();

    // Post-fix expectation: user's edit survives the settings change
    expect(component['model']().name).toBe('User Edit');
  });
});
