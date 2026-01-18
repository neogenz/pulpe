import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';
import localeFrCH from '@angular/common/locales/fr-CH';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { type BudgetLine, type Transaction } from 'pulpe-shared';
import {
  BudgetEnvelopeDetailPanel,
  type BudgetEnvelopeDetailDialogData,
} from './budget-envelope-detail-panel';
import type {
  BudgetLineConsumptionDisplay,
  BudgetLineTableItem,
} from './budget-table-models';

registerLocaleData(localeDeCH);
registerLocaleData(localeFrCH);

interface MockBudgetLineTableItemOverrides {
  data?: Partial<BudgetLine>;
  consumption?: Partial<BudgetLineConsumptionDisplay>;
  metadata?: Partial<BudgetLineTableItem['metadata']>;
}

const createMockBudgetLineTableItem = (
  overrides: MockBudgetLineTableItemOverrides = {},
): BudgetLineTableItem => {
  const baseData: BudgetLine = {
    id: 'budget-line-1',
    budgetId: 'budget-1',
    templateLineId: null,
    savingsGoalId: null,
    name: 'Courses alimentaires',
    amount: 500,
    kind: 'expense',
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseConsumption: BudgetLineConsumptionDisplay = {
    consumed: 400,
    transactionCount: 2,
    percentage: 80,
    transactionCountLabel: '2 dépenses',
    hasTransactions: true,
  };

  const baseMetadata: BudgetLineTableItem['metadata'] = {
    itemType: 'budget_line',
    cumulativeBalance: 5000,
    isRollover: false,
    canResetFromTemplate: false,
    isLoading: false,
    kindIcon: 'arrow_downward',
    allocationLabel: 'Saisir une dépense',
  };

  return {
    data: { ...baseData, ...overrides.data },
    consumption: { ...baseConsumption, ...overrides.consumption },
    metadata: { ...baseMetadata, ...overrides.metadata },
  };
};

const createMockTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: 'tx-1',
  budgetId: 'budget-1',
  budgetLineId: 'budget-line-1',
  name: 'Migros',
  amount: 120,
  kind: 'expense',
  transactionDate: new Date().toISOString(),
  category: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  checkedAt: null,
  ...overrides,
});

const createMockDialogData = (
  overrides: Partial<BudgetEnvelopeDetailDialogData> = {},
): BudgetEnvelopeDetailDialogData => {
  const transactionsSignal = signal<Transaction[]>([]);

  return {
    item: createMockBudgetLineTableItem(),
    transactions: transactionsSignal.asReadonly(),
    onAddTransaction: vi.fn(),
    onDeleteTransaction: vi.fn(),
    onToggleTransactionCheck: vi.fn(),
    ...overrides,
  };
};

describe('BudgetEnvelopeDetailPanel', () => {
  let component: BudgetEnvelopeDetailPanel;
  let fixture: ComponentFixture<BudgetEnvelopeDetailPanel>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockDialogData: BudgetEnvelopeDetailDialogData;
  let transactionsSignal: ReturnType<typeof signal<Transaction[]>>;

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };
    transactionsSignal = signal<Transaction[]>([]);

    mockDialogData = {
      item: createMockBudgetLineTableItem(),
      transactions: transactionsSignal.asReadonly(),
      onAddTransaction: vi.fn(),
      onDeleteTransaction: vi.fn(),
      onToggleTransactionCheck: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BudgetEnvelopeDetailPanel, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetEnvelopeDetailPanel);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  describe('Dialog lifecycle', () => {
    it('should inject MAT_DIALOG_DATA correctly', () => {
      expect(component['data']).toBe(mockDialogData);
    });

    it('should close dialog when close button clicked', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const closeButton = compiled.querySelector(
        'button[matIconButton]',
      ) as HTMLButtonElement;
      closeButton?.click();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it('should call dialogRef.close without data', () => {
      component.close();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('Computed allocatedTransactions', () => {
    it('should filter transactions by budgetLineId', () => {
      const matchingTx = createMockTransaction({
        id: 'tx-1',
        budgetLineId: 'budget-line-1',
      });
      transactionsSignal.set([matchingTx]);
      fixture.detectChanges();

      expect(component.allocatedTransactions()).toHaveLength(1);
      expect(component.allocatedTransactions()[0].id).toBe('tx-1');
    });

    it('should return empty array when no transactions match', () => {
      const nonMatchingTx = createMockTransaction({
        id: 'tx-1',
        budgetLineId: 'other-budget-line',
      });
      transactionsSignal.set([nonMatchingTx]);
      fixture.detectChanges();

      expect(component.allocatedTransactions()).toHaveLength(0);
    });

    it('should update when transactions signal changes', () => {
      expect(component.allocatedTransactions()).toHaveLength(0);

      const newTx = createMockTransaction({
        id: 'tx-new',
        budgetLineId: 'budget-line-1',
      });
      transactionsSignal.set([newTx]);

      expect(component.allocatedTransactions()).toHaveLength(1);
    });

    it('should exclude transactions with different budgetLineId', () => {
      const matchingTx = createMockTransaction({
        id: 'tx-1',
        budgetLineId: 'budget-line-1',
      });
      const nonMatchingTx = createMockTransaction({
        id: 'tx-2',
        budgetLineId: 'budget-line-other',
      });
      transactionsSignal.set([matchingTx, nonMatchingTx]);
      fixture.detectChanges();

      expect(component.allocatedTransactions()).toHaveLength(1);
      expect(component.allocatedTransactions()[0].id).toBe('tx-1');
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no transactions', () => {
      transactionsSignal.set([]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Aucune transaction');
    });

    it('should display empty state icon and message', () => {
      transactionsSignal.set([]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // Find the empty state section
      const emptyStateSection = compiled.querySelector('.text-center.py-8');
      expect(emptyStateSection).toBeTruthy();
      expect(compiled.textContent).toContain(
        'Ajoute une transaction pour suivre tes dépenses',
      );
    });

    it('should show add button in empty state', () => {
      transactionsSignal.set([]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const addButton = compiled.querySelector(
        'button[matButton]',
      ) as HTMLButtonElement;
      expect(addButton).toBeTruthy();
      expect(addButton?.textContent).toContain('Ajouter');
    });
  });

  describe('Transaction list', () => {
    const setupTransactions = () => {
      const transactions = [
        createMockTransaction({
          id: 'tx-1',
          name: 'Migros',
          budgetLineId: 'budget-line-1',
        }),
        createMockTransaction({
          id: 'tx-2',
          name: 'Coop',
          budgetLineId: 'budget-line-1',
        }),
        createMockTransaction({
          id: 'tx-3',
          name: 'Lidl',
          budgetLineId: 'budget-line-1',
        }),
      ];
      transactionsSignal.set(transactions);
      fixture.detectChanges();
      return transactions;
    };

    it('should display transaction count in header', () => {
      setupTransactions();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('(3)');
    });

    it('should render all allocated transactions', () => {
      setupTransactions();

      const compiled = fixture.nativeElement as HTMLElement;
      const txItems = compiled.querySelectorAll(
        '[data-testid^="detail-transaction-"]',
      );
      expect(txItems.length).toBe(3);
    });

    it('should apply strikethrough to checked transactions', () => {
      const checkedTx = createMockTransaction({
        id: 'tx-checked',
        name: 'Checked Transaction',
        budgetLineId: 'budget-line-1',
        checkedAt: new Date().toISOString(),
      });
      transactionsSignal.set([checkedTx]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const strikethroughElement = compiled.querySelector('.line-through');
      expect(strikethroughElement).toBeTruthy();
    });

    it('should format transaction date correctly', () => {
      const tx = createMockTransaction({
        id: 'tx-date',
        budgetLineId: 'budget-line-1',
        transactionDate: '2024-03-15T10:00:00.000Z',
      });
      transactionsSignal.set([tx]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('15.03.2024');
    });

    it('should display correct data-testid for each transaction', () => {
      const transactions = setupTransactions();

      const compiled = fixture.nativeElement as HTMLElement;
      transactions.forEach((tx) => {
        const txElement = compiled.querySelector(
          `[data-testid="detail-transaction-${tx.id}"]`,
        );
        expect(txElement).toBeTruthy();
      });
    });
  });

  describe('Callback invocations', () => {
    it('should call onAddTransaction with BudgetLine', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const addButton = compiled.querySelector(
        'button[matButton]',
      ) as HTMLButtonElement;
      addButton?.click();

      expect(mockDialogData.onAddTransaction).toHaveBeenCalledWith(
        mockDialogData.item.data,
      );
    });

    it('should call onDeleteTransaction with transaction id', () => {
      const tx = createMockTransaction({
        id: 'tx-to-delete',
        budgetLineId: 'budget-line-1',
      });
      transactionsSignal.set([tx]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const deleteButton = compiled.querySelector(
        '[data-testid="delete-tx-tx-to-delete"]',
      ) as HTMLButtonElement;
      deleteButton?.click();

      expect(mockDialogData.onDeleteTransaction).toHaveBeenCalledWith(
        'tx-to-delete',
      );
    });

    it('should call onToggleTransactionCheck with transaction id', () => {
      const tx = createMockTransaction({
        id: 'tx-to-toggle',
        budgetLineId: 'budget-line-1',
      });
      transactionsSignal.set([tx]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const toggle = compiled.querySelector(
        '[data-testid="toggle-tx-check-tx-to-toggle"]',
      ) as HTMLElement;

      // Mat-slide-toggle requires clicking the button element
      const toggleButton = toggle?.querySelector('button');
      toggleButton?.click();
      fixture.detectChanges();

      expect(mockDialogData.onToggleTransactionCheck).toHaveBeenCalledWith(
        'tx-to-toggle',
      );
    });
  });

  describe('Financial display', () => {
    it('should display planned, consumed and remaining amounts', () => {
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.textContent).toContain('Prévu');
      expect(compiled.textContent).toContain('Dépensé');
      expect(compiled.textContent).toContain('Reste');
      // Currency format is CHF500 (no space) based on de-CH locale
      expect(compiled.textContent).toContain('CHF');
      expect(compiled.textContent).toContain('500');
      expect(compiled.textContent).toContain('400');
      expect(compiled.textContent).toContain('100');
    });

    it('should show error color when remaining is negative', () => {
      const overspentItem = createMockBudgetLineTableItem({
        data: { amount: 300 },
        consumption: { consumed: 400, hasTransactions: true, percentage: 133 },
      });

      mockDialogData = createMockDialogData({
        item: overspentItem,
        transactions: transactionsSignal.asReadonly(),
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [BudgetEnvelopeDetailPanel, NoopAnimationsModule],
        providers: [
          provideZonelessChangeDetection(),
          { provide: MatDialogRef, useValue: mockDialogRef },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(BudgetEnvelopeDetailPanel);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const errorElement = compiled.querySelector('.text-error');
      expect(errorElement).toBeTruthy();
      // Currency format is -CHF100 (no space) based on locale
      expect(errorElement?.textContent).toContain('-CHF');
      expect(errorElement?.textContent).toContain('100');
    });

    it('should show progress bar with correct segments', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const progressSegments = compiled.querySelectorAll(
        '.rounded-full.flex-1',
      );
      expect(progressSegments.length).toBe(12);
    });
  });
});
