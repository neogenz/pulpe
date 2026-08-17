import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { Router } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import type { BudgetLineConsumption } from '@core/budget';
import type { AllocatedTransactionsDialogData } from './dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { UserSettingsStore } from '@core/user-settings';
import { BudgetDetailsStore } from '../../store/budget-details-store';
import { AllocatedTransactionsBottomSheet } from './bottom-sheet';

function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    budgetId: 'budget-1',
    budgetLineId: 'bl-1',
    name: 'Courses',
    amount: 50,
    kind: 'expense',
    transactionDate: '2025-01-15T00:00:00+01:00',
    tagIds: [],
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
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  function setup(
    overrides: Parameters<typeof buildDialogData>[0] = {},
    savingsGoalNameById = new Map<string, string>(),
  ): void {
    const data = buildDialogData(overrides);
    mockBottomSheetRef = { dismiss: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AllocatedTransactionsBottomSheet],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: data },
        { provide: MatBottomSheetRef, useValue: mockBottomSheetRef },
        { provide: Router, useValue: mockRouter },
        {
          provide: UserSettingsStore,
          useValue: { currency: signal('CHF'), payDayOfMonth: signal(1) },
        },
        {
          provide: BudgetDetailsStore,
          useValue: {
            spreadOccurrences: signal([]),
            isSpreadOccurrencesLoading: signal(false),
            spreadOccurrencesError: signal(null),
            budgetDetails: signal({ month: 1, year: 2025 }),
            savingsGoalNameById: signal(savingsGoalNameById),
          },
        },
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
      expect(el.textContent).toContain('CHF');
      expect(el.textContent).toContain('50.00');
      expect(el.textContent).toContain('30.00');
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

      expect(el.textContent).toContain('Rien de noté ici');
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

    it('should show a round overage when the budget amount is 0', () => {
      setup({
        budgetLine: { amount: 0 },
        consumption: { consumed: 50 },
      });

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Dépassé de 80 CHF');
      expect(el.textContent).not.toContain('80.00 CHF');
    });

    it('should show a cent-level overage instead of rounded zeroes', () => {
      setup({
        budgetLine: { amount: 58.5 },
        transactions: [
          buildTransaction({ id: 'tx-1', amount: 39.9 }),
          buildTransaction({ id: 'tx-2', amount: 18.65 }),
        ],
      });

      const text = (fixture.nativeElement.textContent as string).replace(
        /\s+/g,
        ' ',
      );
      expect(text).toContain('58.55 CHF');
      expect(text).toContain('-0.05 CHF');
      expect(text).toContain('Dépassé de 0.05 CHF');
      expect(text).not.toContain('Dépassé de 0 CHF');
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
            name: 'Déjà pointé',
            checkedAt: '2025-01-20T10:00:00+01:00',
          }),
        ],
      });

      const nameSpan = fixture.nativeElement.querySelector(
        '[data-testid="deleted-amount"]',
      );
      expect(nameSpan).not.toBeNull();
      expect(nameSpan.textContent).toContain('Déjà pointé');
    });
  });

  describe('actions', () => {
    it('should dismiss with add action when "Noter un montant" is clicked', () => {
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
        'button[aria-label="Modifier cette ligne"]',
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
        'button[aria-label="Supprimer cette ligne"]',
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

  describe('linked savings goal', () => {
    it('should show the linked goal name for a saving line tied to a goal', () => {
      setup(
        { budgetLine: { kind: 'saving', savingsGoalId: 'goal-1' } },
        new Map([['goal-1', 'Vacances']]),
      );

      const affordance = fixture.nativeElement.querySelector(
        '[data-testid="allocated-transactions-bottom-sheet-linked-goal"]',
      );
      expect(affordance).not.toBeNull();
      expect(affordance.textContent).toContain('Vacances');
    });

    it('should dismiss and navigate to the goal detail when clicked', () => {
      setup(
        { budgetLine: { kind: 'saving', savingsGoalId: 'goal-1' } },
        new Map([['goal-1', 'Vacances']]),
      );

      const affordance: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="allocated-transactions-bottom-sheet-linked-goal"]',
      );
      affordance.click();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/',
        'savings-goals',
        'goal-1',
      ]);
    });
  });
});
