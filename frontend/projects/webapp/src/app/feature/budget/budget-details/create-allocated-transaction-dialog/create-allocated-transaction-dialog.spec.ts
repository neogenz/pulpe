import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  CreateAllocatedTransactionDialog,
  type CreateAllocatedTransactionDialogData,
} from './create-allocated-transaction-dialog';

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

describe('CreateAllocatedTransactionDialog', () => {
  let component: CreateAllocatedTransactionDialog;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let dialogData: CreateAllocatedTransactionDialogData;

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };
    dialogData = createDialogData();

    await TestBed.configureTestingModule({
      imports: [CreateAllocatedTransactionDialog],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideNativeDateAdapter(),
        ...provideTranslocoForTest(),
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    component = TestBed.createComponent(
      CreateAllocatedTransactionDialog,
    ).componentInstance;
  });

  describe('checked toggle', () => {
    it('should set checkedAt to null by default', () => {
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component.form.patchValue({
        name: 'Test',
        amount: 10,
        transactionDate: midMonth,
      });

      component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ checkedAt: null }),
      );
    });

    it('should set checkedAt to ISO string when isChecked is true', () => {
      const midMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        15,
      );
      component.form.patchValue({
        name: 'Test',
        amount: 10,
        transactionDate: midMonth,
        isChecked: true,
      });

      component.submit();

      const callArg = mockDialogRef.close.mock.calls[0][0];
      expect(callArg.checkedAt).toBeDefined();
      expect(typeof callArg.checkedAt).toBe('string');
      expect(() => new Date(callArg.checkedAt)).not.toThrow();
    });
  });
});
