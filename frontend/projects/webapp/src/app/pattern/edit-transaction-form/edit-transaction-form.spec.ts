import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  EditTransactionForm,
  type EditTransactionFormData,
} from './edit-transaction-form';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { describe, it, expect, beforeEach } from 'vitest';

describe('EditTransactionForm', () => {
  let component: EditTransactionForm;
  let fixture: ComponentFixture<EditTransactionForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditTransactionForm, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        provideAnimationsAsync(),
        provideNativeDateAdapter(),
      ],
    }).compileComponents();

    // Create component instance directly for unit testing
    fixture = TestBed.createComponent(EditTransactionForm);
    component = fixture.componentInstance;
  });

  describe('Component Structure', () => {
    it('should have required properties defined', () => {
      // Verify signal inputs
      expect(component.transaction).toBeDefined();
      expect(typeof component.transaction).toBe('function'); // signal

      // Verify outputs
      expect(component.updateTransaction).toBeDefined();
      expect(typeof component.updateTransaction.emit).toBe('function');
      expect(component.cancelEdit).toBeDefined();
      expect(typeof component.cancelEdit.emit).toBe('function');

      // Verify loading state signal
      expect(component.isUpdating).toBeDefined();
      expect(typeof component.isUpdating).toBe('function');
      expect(component.isUpdating()).toBe(false); // Initial state
    });

    it('should have form controls defined', () => {
      expect(component.transactionForm).toBeDefined();
      expect(component.transactionForm.get('name')).toBeDefined();
      expect(component.transactionForm.get('amount')).toBeDefined();
      expect(component.transactionForm.get('kind')).toBeDefined();
      expect(component.transactionForm.get('transactionDate')).toBeDefined();
      expect(component.transactionForm.get('category')).toBeDefined();
    });

    it('should have proper form validators', () => {
      const nameControl = component.transactionForm.get('name');
      const amountControl = component.transactionForm.get('amount');
      const kindControl = component.transactionForm.get('kind');
      const dateControl = component.transactionForm.get('transactionDate');

      // Test required validators
      nameControl?.setValue('');
      expect(nameControl?.hasError('required')).toBe(true);

      amountControl?.setValue(null);
      expect(amountControl?.hasError('required')).toBe(true);

      // Test min validator for amount
      amountControl?.setValue(0);
      expect(amountControl?.hasError('min')).toBe(true);

      amountControl?.setValue(0.01);
      expect(amountControl?.hasError('min')).toBe(false);

      kindControl?.setValue(null!);
      expect(kindControl?.hasError('required')).toBe(true);

      dateControl?.setValue(null);
      expect(dateControl?.hasError('required')).toBe(true);
    });
  });

  describe('Form Initialization', () => {
    it('should initialize form with transaction data', () => {
      // Form should be initialized in ngOnInit
      expect(component.transactionForm.value.name).toBeDefined();
      expect(component.transactionForm.pristine).toBe(true);
      expect(component.transactionForm.untouched).toBe(true);
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      setTestInput(component.transaction, {
        id: 'tx-1',
        budgetId: 'b-1',
        budgetLineId: null,
        name: 'Test',
        amount: 10,
        kind: 'expense',
        transactionDate: new Date().toISOString(),
        category: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checkedAt: null,
      });
    });

    it('should set loading state when form is submitted', async () => {
      // Set up valid form data
      component.transactionForm.patchValue({
        name: 'Test',
        amount: 100,
        kind: 'expense',
        transactionDate: new Date(),
        category: 'Test Category',
      });

      expect(component.isUpdating()).toBe(false);

      // Submit form
      await component.onSubmit();

      // Verify loading state is set
      expect(component.isUpdating()).toBe(true);
    });

    it('should not submit when form is invalid', () => {
      // Make form invalid
      component.transactionForm.patchValue({
        name: '',
        amount: null,
      });

      const initialLoadingState = component.isUpdating();

      // Try to submit
      component.onSubmit();

      // Verify loading state hasn't changed
      expect(component.isUpdating()).toBe(initialLoadingState);
    });

    it('should not submit when already updating', async () => {
      // Set up valid form
      component.transactionForm.patchValue({
        name: 'Test',
        amount: 100,
        kind: 'expense',
        transactionDate: new Date(),
        category: 'Test',
      });

      // First submit sets isUpdating to true
      await component.onSubmit();
      expect(component.isUpdating()).toBe(true);

      // Second submit should be a no-op (guard against double submit)
      await component.onSubmit();
      expect(component.isUpdating()).toBe(true);
    });
  });

  describe('Date Constraints', () => {
    beforeEach(() => {
      setTestInput(component.transaction, {
        id: 'tx-1',
        budgetId: 'b-1',
        budgetLineId: null,
        name: 'Test',
        amount: 10,
        kind: 'expense',
        transactionDate: new Date().toISOString(),
        category: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checkedAt: null,
      });
    });

    it('should default to current month bounds', () => {
      // Arrange
      const dateControl = component.transactionForm.get('transactionDate');
      const now = new Date();

      // Act — set a date in the current month
      dateControl?.setValue(now);

      // Assert — date in current month is valid
      expect(dateControl?.hasError('dateOutOfRange')).toBe(false);
    });

    it('should reject dates outside current month when no custom bounds', () => {
      // Arrange
      const dateControl = component.transactionForm.get('transactionDate');
      const lastYear = new Date(new Date().getFullYear() - 1, 0, 15);

      // Act
      dateControl?.setValue(lastYear);

      // Assert
      expect(dateControl?.hasError('dateOutOfRange')).toBe(true);
    });

    it('should validate against custom min/max when signal inputs are provided', () => {
      const dateControl = component.transactionForm.get('transactionDate');
      const customMin = new Date(2024, 0, 1);
      const customMax = new Date(2024, 0, 31);

      setTestInput(component.minDateInput, customMin);
      setTestInput(component.maxDateInput, customMax);
      TestBed.flushEffects();

      dateControl?.setValue(new Date(2024, 0, 15));
      expect(dateControl?.hasError('dateOutOfRange')).toBe(false);

      dateControl?.setValue(new Date(2024, 5, 15));
      expect(dateControl?.hasError('dateOutOfRange')).toBe(true);
    });

    it('should re-validate when bounds change via effect()', () => {
      const dateControl = component.transactionForm.get('transactionDate');

      setTestInput(component.minDateInput, new Date(2024, 0, 1));
      setTestInput(component.maxDateInput, new Date(2024, 0, 31));
      TestBed.flushEffects();

      dateControl?.setValue(new Date(2024, 0, 15));
      expect(dateControl?.hasError('dateOutOfRange')).toBe(false);

      setTestInput(component.minDateInput, new Date(2024, 1, 1));
      setTestInput(component.maxDateInput, new Date(2024, 1, 29));
      TestBed.flushEffects();

      expect(dateControl?.hasError('dateOutOfRange')).toBe(true);
    });
  });

  describe('hiddenFields', () => {
    it('should default to empty array (no hidden fields)', () => {
      expect(component.hiddenFields()).toEqual([]);
      expect(component['isFieldHidden']('kind')).toBe(false);
      expect(component['isFieldHidden']('category')).toBe(false);
    });

    it('should still emit original values for hidden fields on submit', async () => {
      setTestInput(component.transaction, {
        id: 'tx-1',
        budgetId: 'b-1',
        budgetLineId: null,
        name: 'Test',
        amount: 10,
        kind: 'expense',
        transactionDate: new Date().toISOString(),
        category: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checkedAt: null,
      });

      // hiddenFields only controls template visibility, not form data
      // Even with hidden fields, the form group still contains all values
      component.transactionForm.patchValue({
        name: 'Test',
        amount: 100,
        kind: 'expense',
        transactionDate: new Date(),
        category: 'Notes',
      });

      let emittedData: EditTransactionFormData | undefined;
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
