import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { UserSettingsStore } from '@core/user-settings';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import type { TemplateLine } from 'pulpe-shared';
import {
  EditTemplateLineDialog,
  type EditTemplateLineDialogData,
} from './edit-template-line-dialog';
import type { TemplateLineFormInput } from '../services/template-line-store';

const baseLine: TemplateLine = {
  id: 'line-1',
  templateId: 'template-1',
  name: 'Loyer',
  amount: 1500,
  kind: 'expense',
  recurrence: 'fixed',
  description: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

interface SetupOptions {
  line?: TemplateLine;
  templateName?: string;
}

function setup(options: SetupOptions = {}): {
  fixture: ComponentFixture<EditTemplateLineDialog>;
  component: EditTemplateLineDialog;
  dialogRef: { close: Mock };
  converter: { convertWithMetadata: Mock };
} {
  const dialogRef = { close: vi.fn() };
  const converter = {
    convertWithMetadata: vi
      .fn()
      .mockResolvedValue({ convertedAmount: 0, metadata: null }),
  };

  const mockUserSettings = {
    currency: signal('CHF' as const),
    settings: signal(null),
  };

  const mockFeatureFlags = {
    isMultiCurrencyEnabled: signal(false),
  };

  const data: EditTemplateLineDialogData = {
    line: options.line,
    templateName: options.templateName ?? 'Mon modèle',
  };

  TestBed.configureTestingModule({
    imports: [EditTemplateLineDialog],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: UserSettingsStore, useValue: mockUserSettings },
      { provide: CurrencyConverterService, useValue: converter },
      { provide: FeatureFlagsService, useValue: mockFeatureFlags },
    ],
  });

  const fixture = TestBed.createComponent(EditTemplateLineDialog);
  return {
    fixture,
    component: fixture.componentInstance,
    dialogRef,
    converter,
  };
}

describe('EditTemplateLineDialog', () => {
  describe('Create mode (no line)', () => {
    let component: EditTemplateLineDialog;

    beforeEach(() => {
      ({ component } = setup({ templateName: 'Mon modèle' }));
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should not be in edit mode', () => {
      expect(component['isEditMode']()).toBe(false);
    });

    it('should initialize form with default values', () => {
      expect(component['model']().name).toBe('');
      expect(component['model']().money.amount).toBeNull();
      expect(component['model']().kind).toBe('expense');
    });

    it('should mark form invalid when empty', () => {
      expect(component['addForm']().valid()).toBe(false);
    });

    it('should validate name required', () => {
      component['model'].update((m) => ({ ...m, name: '' }));
      const errors = component['addForm'].name().errors();
      expect(errors.some((e: { kind: string }) => e.kind === 'required')).toBe(
        true,
      );
    });

    it('should validate amount min 0.01', () => {
      component['model'].update((m) => ({
        ...m,
        money: { ...m.money, amount: 0 },
      }));
      const errors = component['addForm'].money.amount().errors();
      expect(errors.some((e: { kind: string }) => e.kind === 'min')).toBe(true);
    });

    it('should become valid with correct inputs', () => {
      component['model'].update((m) => ({
        ...m,
        name: 'Salaire',
        money: { ...m.money, amount: 5000 },
        kind: 'income' as const,
      }));
      expect(component['addForm']().valid()).toBe(true);
    });
  });

  describe('Edit mode (line provided)', () => {
    let component: EditTemplateLineDialog;

    beforeEach(() => {
      ({ component } = setup({ line: baseLine }));
    });

    it('should be in edit mode', () => {
      expect(component['isEditMode']()).toBe(true);
    });

    it('should pre-fill form with line values', () => {
      expect(component['model']().name).toBe('Loyer');
      expect(component['model']().money.amount).toBe(1500);
      expect(component['model']().kind).toBe('expense');
    });

    it('should be valid when form is pre-filled from existing line', () => {
      expect(component['addForm']().valid()).toBe(true);
    });
  });

  describe('Submit', () => {
    it('should close with form values when valid', async () => {
      const { component, dialogRef, converter } = setup({ line: baseLine });
      converter.convertWithMetadata.mockResolvedValue({
        convertedAmount: 1600,
        metadata: null,
      });
      component['model'].update((m) => ({
        ...m,
        name: '  Loyer Updated  ',
        money: { ...m.money, amount: 1600 },
      }));

      await component.handleSubmit();

      expect(dialogRef.close).toHaveBeenCalledOnce();
      const closeArg = dialogRef.close.mock
        .calls[0][0] as TemplateLineFormInput;
      expect(closeArg.name).toBe('Loyer Updated');
      expect(closeArg.amount).toBe(1600);
      expect(closeArg.kind).toBe('expense');
    });

    it('should NOT close when form is invalid', async () => {
      const { component, dialogRef } = setup();
      component['model'].update((m) => ({
        ...m,
        name: '',
        money: { ...m.money, amount: 0 },
      }));

      await component.handleSubmit();

      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('Cancel', () => {
    it('should close the dialog with no value', () => {
      const { component, dialogRef } = setup({ line: baseLine });

      component.handleCancel();

      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });
});

interface CurrencySetupOptions {
  line?: TemplateLine;
  userCurrency: 'CHF' | 'EUR';
  flagEnabled: boolean;
}

function setupWithCurrency(options: CurrencySetupOptions): {
  fixture: ComponentFixture<EditTemplateLineDialog>;
  component: EditTemplateLineDialog;
  dialogRef: { close: Mock };
  converter: { convertWithMetadata: Mock };
  flags: { isMultiCurrencyEnabled: ReturnType<typeof signal> };
  settings: {
    currency: ReturnType<typeof signal<'CHF' | 'EUR'>>;
  };
} {
  const dialogRef = { close: vi.fn() };
  const converter = {
    convertWithMetadata: vi
      .fn()
      .mockResolvedValue({ convertedAmount: 0, metadata: null }),
  };
  const flags = { isMultiCurrencyEnabled: signal(options.flagEnabled) };
  const settings = {
    currency: signal<'CHF' | 'EUR'>(options.userCurrency),
  };

  const data: EditTemplateLineDialogData = {
    line: options.line,
    templateName: 'Mon modèle',
  };

  TestBed.configureTestingModule({
    imports: [EditTemplateLineDialog],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
      { provide: FeatureFlagsService, useValue: flags },
    ],
  });

  const fixture = TestBed.createComponent(EditTemplateLineDialog);
  return {
    fixture,
    component: fixture.componentInstance,
    dialogRef,
    converter,
    flags,
    settings,
  };
}

describe('EditTemplateLineDialog — Create mode currency rules', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('B4: should initialize inputCurrency to user currency', () => {
    const { component } = setupWithCurrency({
      userCurrency: 'EUR',
      flagEnabled: true,
    });

    expect(component['model']().money.inputCurrency).toBe('EUR');
  });

  it('B6: should call convertWithMetadata and include metadata in result when currencies differ', async () => {
    const { component, dialogRef, converter } = setupWithCurrency({
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
      name: 'Charges',
      money: { ...m.money, amount: 150, inputCurrency: 'EUR' as const },
      kind: 'expense' as const,
    }));

    await component.handleSubmit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      150,
      'EUR',
      'CHF',
    );
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const result = dialogRef.close.mock.calls[0][0];
    expect(result.amount).toBe(180);
    expect(result.originalAmount).toBe(150);
    expect(result.originalCurrency).toBe('EUR');
  });

  it('B7: should block submit and set conversionError when convertWithMetadata throws', async () => {
    const { component, dialogRef, converter } = setupWithCurrency({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockRejectedValue(new Error('rate down'));
    component['model'].update((m) => ({
      ...m,
      name: 'Charges',
      money: { ...m.money, amount: 100, inputCurrency: 'EUR' as const },
      kind: 'expense' as const,
    }));

    await component.handleSubmit();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component['conversionError']()).toBe(true);
  });

  it('B8: should omit metadata fields from result when inputCurrency equals userCurrency', async () => {
    const { component, dialogRef, converter } = setupWithCurrency({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 50,
      metadata: null,
    });

    component['model'].update((m) => ({
      ...m,
      name: 'Charges',
      money: { ...m.money, amount: 50 },
      kind: 'expense' as const,
    }));

    await component.handleSubmit();

    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const result = dialogRef.close.mock.calls[0][0];
    expect(result.amount).toBe(50);
    expect(result).not.toHaveProperty('originalAmount');
    expect(result).not.toHaveProperty('originalCurrency');
  });

  it('B18: with no data.line, should resolve to create-mode behavior (isEditMode false)', () => {
    const { component } = setupWithCurrency({
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    expect(component['isEditMode']()).toBe(false);
    expect(component['model']().money.inputCurrency).toBe('CHF');
  });
});

describe('EditTemplateLineDialog — Edit mode currency rules', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const altLine: TemplateLine = {
    ...baseLine,
    amount: 1800,
    originalAmount: 1500,
    originalCurrency: 'EUR',
    targetCurrency: 'CHF',
    exchangeRate: 1.2,
  } as TemplateLine;

  it('B13: should initialize inputCurrency to originalCurrency when present, else user currency', () => {
    const { component: c1 } = setupWithCurrency({
      line: altLine,
      userCurrency: 'CHF',
      flagEnabled: true,
    });
    expect(c1['model']().money.inputCurrency).toBe('EUR');

    TestBed.resetTestingModule();

    const { component: c2 } = setupWithCurrency({
      line: baseLine,
      userCurrency: 'CHF',
      flagEnabled: true,
    });
    expect(c2['model']().money.inputCurrency).toBe('CHF');
  });

  it('B14: should include metadata in result when picker is visible (alternate-currency edit)', async () => {
    const { component, dialogRef, converter } = setupWithCurrency({
      line: altLine,
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 1900,
      metadata: {
        originalAmount: 1600,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 1.1875,
      },
    });

    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 1600 },
    }));

    await component.handleSubmit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      1600,
      'EUR',
      'CHF',
    );
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const result = dialogRef.close.mock.calls[0][0];
    expect(result.amount).toBe(1900);
    expect(result.originalAmount).toBe(1600);
    expect(result.originalCurrency).toBe('EUR');
    expect(result.targetCurrency).toBe('CHF');
    expect(result.exchangeRate).toBe(1.1875);
  });

  it('B15: should omit metadata from result when picker is hidden (mono-currency edit, converter short-circuits)', async () => {
    const { component, dialogRef, converter } = setupWithCurrency({
      line: baseLine,
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 1800,
      metadata: null,
    });

    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 1800 },
    }));

    await component.handleSubmit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      1800,
      'CHF',
      'CHF',
    );
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const result = dialogRef.close.mock.calls[0][0];
    expect(result.amount).toBe(1800);
    expect(result).not.toHaveProperty('originalAmount');
    expect(result).not.toHaveProperty('originalCurrency');
  });

  it('B16: should block submit and set conversionError on alternate-currency edit when converter throws', async () => {
    const { component, dialogRef, converter } = setupWithCurrency({
      line: altLine,
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    converter.convertWithMetadata.mockRejectedValue(new Error('rate down'));
    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 1600 },
    }));

    await component.handleSubmit();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component['conversionError']()).toBe(true);
  });

  it('B19: with data.line provided, should resolve to edit-mode behavior (isEditMode true)', () => {
    const { component } = setupWithCurrency({
      line: baseLine,
      userCurrency: 'CHF',
      flagEnabled: true,
    });

    expect(component['isEditMode']()).toBe(true);
    expect(component['model']().name).toBe('Loyer');
  });
});
