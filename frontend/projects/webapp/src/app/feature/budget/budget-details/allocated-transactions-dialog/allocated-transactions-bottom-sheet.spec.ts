import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { describe, it, expect, vi } from 'vitest';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import type { BudgetLineConsumption } from '@core/budget';
import type { AllocatedTransactionsDialogData } from './allocated-transactions-dialog';
import { AllocatedTransactionsBottomSheet } from './allocated-transactions-bottom-sheet';

function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    budgetId: 'budget-1',
    budgetLineId: 'bl-1',
    name: 'Courses',
    amount: 50,
    kind: 'expense',
    transactionDate: '2025-01-15T00:00:00+01:00',
    category: null,
    createdAt: '2025-01-15T00:00:00+01:00',
    updatedAt: '2025-01-15T00:00:00+01:00',
    checkedAt: null,
    ...overrides,
  };
}

function buildBudgetLine(overrides: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: 'bl-1',
    budgetId: 'budget-1',
    templateLineId: null,
    savingsGoalId: null,
    name: 'Alimentation',
    amount: 200,
    kind: 'expense',
    recurrence: 'one_off',
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: '2025-01-01T00:00:00+01:00',
    updatedAt: '2025-01-01T00:00:00+01:00',
    ...overrides,
  };
}

function buildDialogData(
  overrides: {
    budgetLine?: Partial<BudgetLine>;
    consumption?: Partial<BudgetLineConsumption>;
    onToggleTransactionCheck?: (id: string) => void;
    transactions?: Transaction[];
  } = {},
): AllocatedTransactionsDialogData {
  const budgetLine = buildBudgetLine(overrides.budgetLine);
  const transactions = overrides.transactions ?? [
    buildTransaction({ id: 'tx-1', name: 'Courses', amount: 50 }),
    buildTransaction({
      id: 'tx-2',
      name: 'Restaurant',
      amount: 30,
      transactionDate: '2025-01-20T00:00:00+01:00',
    }),
  ];

  return {
    budgetLine,
    consumption: {
      budgetLine,
      consumed: 80,
      remaining: 120,
      allocatedTransactions: transactions,
      transactionCount: transactions.length,
      ...overrides.consumption,
    },
    onToggleTransactionCheck: overrides.onToggleTransactionCheck,
  };
}

describe('AllocatedTransactionsBottomSheet', () => {
  let fixture: ComponentFixture<AllocatedTransactionsBottomSheet>;
  let mockBottomSheetRef: { dismiss: ReturnType<typeof vi.fn> };

  function setup(overrides: Parameters<typeof buildDialogData>[0] = {}): void {
    const data = buildDialogData(overrides);
    mockBottomSheetRef = { dismiss: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AllocatedTransactionsBottomSheet],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: data },
        { provide: MatBottomSheetRef, useValue: mockBottomSheetRef },
      ],
    });

    fixture = TestBed.createComponent(AllocatedTransactionsBottomSheet);
    fixture.detectChanges();
  }

  describe('displaying transactions', () => {
    it('should show each transaction name and amount', () => {
      setup();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.textContent).toContain('Courses');
      expect(el.textContent).toContain('Restaurant');
      expect(el.textContent).toContain('CHF50.00');
      expect(el.textContent).toContain('CHF30.00');
    });

    it('should show the budget line name in the header', () => {
      setup({ budgetLine: { name: 'Loisirs' } });
      const heading = fixture.nativeElement.querySelector(
        '[data-testid="sheet-title"]',
      );

      expect(heading.textContent).toContain('Loisirs');
    });

    it('should show empty state when no transactions', () => {
      setup({ transactions: [] });
      const el: HTMLElement = fixture.nativeElement;

      expect(el.textContent).toContain('Pas de transaction');
    });

    it('should show consumption percentage', () => {
      setup({
        budgetLine: { amount: 200 },
        consumption: { consumed: 80 },
      });
      const el: HTMLElement = fixture.nativeElement;

      expect(el.textContent).toContain('40');
      expect(el.textContent).toContain('% utilisé');
    });

    it('should show 0% when budget amount is 0', () => {
      setup({
        budgetLine: { amount: 0 },
        consumption: { consumed: 50 },
      });

      // Component guards against division by zero
      expect(fixture.componentInstance.consumptionPercentage).toBe(0);
    });
  });

  describe('toggle check interaction', () => {
    it('should call onToggleTransactionCheck when toggle is changed', () => {
      const onToggle = vi.fn();
      setup({ onToggleTransactionCheck: onToggle });

      const toggle = fixture.nativeElement.querySelector(
        '[data-testid="toggle-tx-check-tx-1"]',
      );
      toggle?.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(onToggle).toHaveBeenCalledWith('tx-1');
    });

    it('should show checked transaction with line-through style', () => {
      setup({
        transactions: [
          buildTransaction({
            id: 'tx-checked',
            name: 'Déjà comptabilisé',
            checkedAt: '2025-01-20T10:00:00+01:00',
          }),
        ],
      });

      const nameSpan = fixture.nativeElement.querySelector(
        '[data-testid="deleted-amount"]',
      );
      expect(nameSpan).not.toBeNull();
      expect(nameSpan.textContent).toContain('Déjà comptabilisé');
    });
  });

  describe('actions', () => {
    it('should dismiss with add action when "Nouvelle transaction" is clicked', () => {
      setup();
      const addBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
        'button[matButton="filled"]',
      );

      addBtn.click();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith({
        action: 'add',
      });
    });

    it('should dismiss with edit action when edit button is clicked', () => {
      setup({
        transactions: [
          buildTransaction({ id: 'tx-1', name: 'Courses', amount: 50 }),
        ],
      });

      const editBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
        'button[aria-label="Modifier la transaction"]',
      );
      editBtn.click();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'edit' }),
      );
    });

    it('should dismiss with delete action when delete button is clicked', () => {
      setup({
        transactions: [
          buildTransaction({ id: 'tx-1', name: 'Courses', amount: 50 }),
        ],
      });

      const deleteBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
        'button[aria-label="Supprimer la transaction"]',
      );
      deleteBtn.click();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete' }),
      );
    });

    it('should dismiss without result when close button is clicked', () => {
      setup();
      const closeBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="close-button"]',
      );

      closeBtn.click();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledWith();
    });
  });
});
