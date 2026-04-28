import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { UserSettingsStore } from '@core/user-settings';
import {
  CurrencyConverterService,
  injectCurrencyFormConfigForEdit,
} from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import type { TemplateLine } from 'pulpe-shared';
import {
  EditTemplateLineDialog,
  type EditTemplateLineDialogData,
  type EditTemplateLineDialogResult,
} from './edit-template-line-dialog';

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
} {
  const dialogRef = { close: vi.fn() };

  const mockUserSettings = {
    currency: signal('CHF' as const),
    showCurrencySelector: signal(false),
    settings: signal(null),
  };

  const mockConverter = {
    convertWithMetadata: vi.fn(),
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
      { provide: CurrencyConverterService, useValue: mockConverter },
      { provide: FeatureFlagsService, useValue: mockFeatureFlags },
    ],
  });

  const fixture = TestBed.createComponent(EditTemplateLineDialog);
  return {
    fixture,
    component: fixture.componentInstance,
    dialogRef,
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
      expect(component.form.get('name')?.value).toBe('');
      expect(component.form.get('amount')?.value).toBeNull();
      expect(component.form.get('kind')?.value).toBe('expense');
    });

    it('should mark form invalid when empty', () => {
      expect(component.form.valid).toBe(false);
    });

    it('should validate name required', () => {
      const nameCtrl = component.form.get('name');
      nameCtrl?.setValue('');
      expect(nameCtrl?.hasError('required')).toBe(true);
    });

    it('should validate amount min 0.01', () => {
      const amountCtrl = component.form.get('amount');
      amountCtrl?.setValue(0);
      expect(amountCtrl?.hasError('min')).toBe(true);
    });

    it('should become valid with correct inputs', () => {
      component.form.patchValue({
        name: 'Salaire',
        amount: 5000,
        kind: 'income',
      });
      expect(component.form.valid).toBe(true);
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
      expect(component.form.get('name')?.value).toBe('Loyer');
      expect(component.form.get('amount')?.value).toBe(1500);
      expect(component.form.get('kind')?.value).toBe('expense');
    });

    it('should be valid when form is pre-filled from existing line', () => {
      expect(component.form.valid).toBe(true);
    });
  });

  describe('Submit', () => {
    it('should close with form values when valid', async () => {
      const { component, dialogRef } = setup({ line: baseLine });
      component.form.patchValue({ name: '  Loyer Updated  ', amount: 1600 });

      await component.handleSubmit();

      expect(dialogRef.close).toHaveBeenCalledOnce();
      const closeArg = dialogRef.close.mock
        .calls[0][0] as EditTemplateLineDialogResult;
      expect(closeArg.name).toBe('Loyer Updated');
      expect(closeArg.amount).toBe(1600);
      expect(closeArg.kind).toBe('expense');
    });

    it('should NOT close when form is invalid', async () => {
      const { component, dialogRef } = setup();
      component.form.patchValue({ name: '', amount: 0 });

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

  describe('Helper sanity check', () => {
    it('injectCurrencyFormConfigForEdit should be re-exported from @core/currency', () => {
      expect(injectCurrencyFormConfigForEdit).toBeDefined();
    });
  });
});
