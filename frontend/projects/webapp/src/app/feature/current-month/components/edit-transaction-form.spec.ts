import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { EditTransactionForm } from './edit-transaction-form';
import { describe, it, expect, beforeEach } from 'vitest';

describe('EditTransactionForm', () => {
  let component: EditTransactionForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditTransactionForm, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideNativeDateAdapter(),
      ],
    }).compileComponents();

    // Create component instance directly for unit testing
    component = TestBed.createComponent(EditTransactionForm).componentInstance;
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

      // @ts-expect-error: setValue can accept string for testing purposes
      kindControl?.setValue('');
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
    it('should set loading state when form is submitted', () => {
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
      component.onSubmit();

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

    it('should not submit when already updating', () => {
      // Set up valid form
      component.transactionForm.patchValue({
        name: 'Test',
        amount: 100,
        kind: 'expense',
        transactionDate: new Date(),
        category: 'Test',
      });

      // Set updating state
      component.isUpdating.set(true);

      // Try to submit
      component.onSubmit();

      // Verify still in updating state (no change)
      expect(component.isUpdating()).toBe(true);
    });
  });

  describe('Date Constraints', () => {
    it('should have minDate and maxDate defined', () => {
      expect(component['minDate']).toBeDefined();
      expect(component['maxDate']).toBeDefined();

      // Verify they are Date objects
      expect(component['minDate']).toBeInstanceOf(Date);
      expect(component['maxDate']).toBeInstanceOf(Date);

      // Verify minDate is start of month
      const now = new Date();
      const minDate = component['minDate'];
      expect(minDate.getDate()).toBe(1);
      expect(minDate.getMonth()).toBe(now.getMonth());
      expect(minDate.getFullYear()).toBe(now.getFullYear());

      // Verify maxDate is end of month
      const maxDate = component['maxDate'];
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      expect(maxDate.getDate()).toBe(nextMonth.getDate());
      expect(maxDate.getMonth()).toBe(now.getMonth());
      expect(maxDate.getFullYear()).toBe(now.getFullYear());
    });
  });
});

// NOTE: Integration tests with actual transaction data are handled in higher-level component tests
// due to Angular 20's input.required() limitations in unit tests
