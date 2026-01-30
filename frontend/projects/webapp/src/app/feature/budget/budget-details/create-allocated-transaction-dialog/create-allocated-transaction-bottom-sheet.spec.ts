import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { getBudgetPeriodForDate } from 'pulpe-shared';
import { CreateAllocatedTransactionBottomSheet } from './create-allocated-transaction-bottom-sheet';
import type { CreateAllocatedTransactionDialogData } from './create-allocated-transaction-dialog';

const createDialogData = (
  overrides: Partial<CreateAllocatedTransactionDialogData['budgetLine']> = {},
): CreateAllocatedTransactionDialogData => ({
  budgetLine: {
    id: 'bl-123',
    budgetId: 'budget-456',
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
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: dialogData },
        { provide: MatBottomSheetRef, useValue: mockBottomSheetRef },
      ],
    }).compileComponents();

    component = TestBed.createComponent(
      CreateAllocatedTransactionBottomSheet,
    ).componentInstance;
  });

  describe('submit', () => {
    it('should dismiss with transaction data when form is valid', () => {
      component.form.patchValue({
        name: 'Consultation médecin',
        amount: 45.5,
        transactionDate: new Date('2026-01-15'),
      });

      component.submit();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetId: 'budget-456',
          budgetLineId: 'bl-123',
          name: 'Consultation médecin',
          amount: 45.5,
          kind: 'expense',
          category: null,
        }),
      );
    });

    it('should not dismiss when form is invalid', () => {
      component.form.patchValue({ name: '', amount: null });

      component.submit();

      expect(mockBottomSheetRef.dismiss).not.toHaveBeenCalled();
    });

    it('should trim whitespace from name', () => {
      component.form.patchValue({
        name: '  Courses  ',
        amount: 20,
        transactionDate: new Date(),
      });

      component.submit();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Courses' }),
      );
    });

    it('should use absolute value of amount', () => {
      component.form.patchValue({
        name: 'Test',
        amount: 42.5,
        transactionDate: new Date(),
      });

      component.submit();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 42.5 }),
      );
    });
  });

  describe('close', () => {
    it('should dismiss without data', () => {
      component.close();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith();
    });
  });

  describe('form validation', () => {
    it('should require name', () => {
      component.form.get('name')?.setValue('');

      expect(component.form.get('name')?.hasError('required')).toBe(true);
    });

    it('should enforce max length on name', () => {
      component.form.get('name')?.setValue('a'.repeat(101));

      expect(component.form.get('name')?.hasError('maxlength')).toBe(true);
    });

    it('should require amount', () => {
      component.form.get('amount')?.setValue(null);

      expect(component.form.get('amount')?.hasError('required')).toBe(true);
    });

    it('should reject amount below 0.01', () => {
      component.form.get('amount')?.setValue(0);

      expect(component.form.get('amount')?.hasError('min')).toBe(true);
    });

    it('should reject negative amount', () => {
      component.form.get('amount')?.setValue(-50);

      expect(component.form.get('amount')?.hasError('min')).toBe(true);
    });

    it('should require transaction date', () => {
      component.form.get('transactionDate')?.setValue(null);

      expect(component.form.get('transactionDate')?.hasError('required')).toBe(
        true,
      );
    });
  });

  describe('date constraints for current month', () => {
    it('should set minDate and maxDate when budget is current month', () => {
      expect(component.isCurrentMonth).toBe(true);
      expect(component.minDate).toBeDefined();
      expect(component.maxDate).toBeDefined();
      expect(component.minDate!.getTime()).toBeLessThanOrEqual(
        component.maxDate!.getTime(),
      );
    });

    it('should not set date constraints when budget is past month', async () => {
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
            { provide: MAT_BOTTOM_SHEET_DATA, useValue: pastData },
            { provide: MatBottomSheetRef, useValue: pastRef },
          ],
        })
        .compileComponents();

      const pastComponent = TestBed.createComponent(
        CreateAllocatedTransactionBottomSheet,
      ).componentInstance;

      expect(pastComponent.isCurrentMonth).toBe(false);
      expect(pastComponent.minDate).toBeUndefined();
      expect(pastComponent.maxDate).toBeUndefined();
    });

    it('should respect custom payDayOfMonth', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 27));

      const currentPeriod = getBudgetPeriodForDate(new Date(), 25);
      const customPayDayData: CreateAllocatedTransactionDialogData = {
        ...createDialogData(),
        budgetMonth: currentPeriod.month,
        budgetYear: currentPeriod.year,
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
            { provide: MAT_BOTTOM_SHEET_DATA, useValue: customPayDayData },
            { provide: MatBottomSheetRef, useValue: customRef },
          ],
        })
        .compileComponents();

      const customComponent = TestBed.createComponent(
        CreateAllocatedTransactionBottomSheet,
      ).componentInstance;

      expect(customComponent.isCurrentMonth).toBe(true);
      expect(customComponent.minDate).toBeDefined();
      expect(customComponent.maxDate).toBeDefined();
      expect(customComponent.minDate!.getDate()).toBe(25);
      expect(customComponent.maxDate!.getDate()).toBe(24);

      vi.useRealTimers();
    });
  });
});
