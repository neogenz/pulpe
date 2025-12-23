import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';
import type { BudgetLineWithConsumption, Transaction } from '@pulpe/shared';
import { createMockBudgetLineWithConsumption } from '../../../../testing/mock-factories';
import { AllocatedTransactionsDialog } from './allocated-transactions-dialog';

// Register locale for currency formatting
registerLocaleData(localeDeCH);

describe('AllocatedTransactionsDialog', () => {
  let fixture: ComponentFixture<AllocatedTransactionsDialog>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  const mockBudgetLine: BudgetLineWithConsumption =
    createMockBudgetLineWithConsumption({
      id: 'line-1',
      name: 'Essence',
      amount: 120,
      kind: 'expense',
      consumedAmount: 65,
      remainingAmount: 55,
    });

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      budgetId: 'budget-1',
      budgetLineId: 'line-1',
      name: 'Plein essence',
      amount: 45,
      kind: 'expense',
      transactionDate: '2024-12-20',
      category: null,
      createdAt: '2024-12-20T10:00:00Z',
      updatedAt: '2024-12-20T10:00:00Z',
    },
    {
      id: 'tx-2',
      budgetId: 'budget-1',
      budgetLineId: 'line-1',
      name: 'Station service',
      amount: 20,
      kind: 'expense',
      transactionDate: '2024-12-15',
      category: null,
      createdAt: '2024-12-15T10:00:00Z',
      updatedAt: '2024-12-15T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AllocatedTransactionsDialog, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            budgetLine: mockBudgetLine,
            transactions: mockTransactions,
          },
        },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AllocatedTransactionsDialog);
    fixture.detectChanges();
  });

  describe('Header Display', () => {
    it('should display the budget line name in header', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const header = compiled.querySelector('[data-testid="dialog-header"]');

      expect(header?.textContent).toContain('Essence');
    });

    it('should display consumption stats', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const stats = compiled.querySelector('[data-testid="consumption-stats"]');

      // Stats should show: "120 CHF prévus · 65 CHF dépensés · 55 CHF restants"
      expect(stats?.textContent).toContain('120');
      expect(stats?.textContent).toContain('prévus');
      expect(stats?.textContent).toContain('65');
      expect(stats?.textContent).toContain('dépensés');
      expect(stats?.textContent).toContain('55');
      expect(stats?.textContent).toContain('restants');
    });
  });

  describe('Transaction List', () => {
    it('should display list of transactions', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const transactionItems = compiled.querySelectorAll(
        '[data-testid^="transaction-item-"]',
      );

      expect(transactionItems.length).toBe(2);
    });

    it('should display transaction details (name, date, amount)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const firstTransaction = compiled.querySelector(
        '[data-testid="transaction-item-tx-1"]',
      );

      expect(firstTransaction?.textContent).toContain('Plein essence');
      expect(firstTransaction?.textContent).toContain('45');
    });

    it('should display transactions sorted by date DESC (most recent first)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const transactionItems = compiled.querySelectorAll(
        '[data-testid^="transaction-item-"]',
      );

      // First should be tx-1 (2024-12-20), second should be tx-2 (2024-12-15)
      expect(transactionItems[0]?.getAttribute('data-testid')).toBe(
        'transaction-item-tx-1',
      );
      expect(transactionItems[1]?.getAttribute('data-testid')).toBe(
        'transaction-item-tx-2',
      );
    });
  });

  describe('Empty State', () => {
    beforeEach(async () => {
      await TestBed.resetTestingModule();

      mockDialogRef = {
        close: vi.fn(),
      };

      const budgetLineNoTransactions = createMockBudgetLineWithConsumption({
        id: 'line-empty',
        name: 'Nouvelle prévision',
        amount: 200,
        consumedAmount: 0,
        remainingAmount: 200,
      });

      await TestBed.configureTestingModule({
        imports: [AllocatedTransactionsDialog, NoopAnimationsModule],
        providers: [
          provideZonelessChangeDetection(),
          {
            provide: MAT_DIALOG_DATA,
            useValue: {
              budgetLine: budgetLineNoTransactions,
              transactions: [],
            },
          },
          { provide: MatDialogRef, useValue: mockDialogRef },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AllocatedTransactionsDialog);
      fixture.detectChanges();
    });

    it('should display empty state message when no transactions', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const emptyState = compiled.querySelector(
        '[data-testid="empty-state-message"]',
      );

      expect(emptyState).toBeTruthy();
      expect(emptyState?.textContent).toContain(
        'Aucune transaction enregistrée',
      );
    });

    it('should not display transaction list when empty', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const transactionList = compiled.querySelector(
        '[data-testid="transaction-list"]',
      );

      expect(transactionList).toBeFalsy();
    });
  });

  describe('Dialog Actions', () => {
    it('should have a close button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const closeButton = compiled.querySelector(
        '[data-testid="close-button"]',
      );

      expect(closeButton).toBeTruthy();
      expect(closeButton?.textContent?.toLowerCase()).toContain('fermer');
    });

    it('should close dialog when close button clicked', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const closeButton = compiled.querySelector(
        '[data-testid="close-button"]',
      ) as HTMLButtonElement;

      closeButton?.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it('should have an add button (disabled for T4)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const addButton = compiled.querySelector(
        '[data-testid="add-transaction-button"]',
      ) as HTMLButtonElement;

      expect(addButton).toBeTruthy();
      expect(addButton?.disabled).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on dialog', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const dialog = compiled.querySelector('[role="dialog"]');

      expect(dialog?.getAttribute('aria-label')).toContain('Essence');
    });

    it('should have proper role on transaction list', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const list = compiled.querySelector('[data-testid="transaction-list"]');

      expect(list?.getAttribute('role')).toBe('list');
    });
  });
});
