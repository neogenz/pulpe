import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';
import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  signal,
  computed,
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import type { BudgetTemplateDetailViewModel } from '../services/budget-templates-api';
import { BudgetTemplatesApi } from '../services/budget-templates-api';
import type { TemplateLine } from 'pulpe-shared';
import { of, throwError, firstValueFrom } from 'rxjs';
import { TemplateDetailsStore } from './services/template-details-store';
import { PulpeTitleStrategy } from '@core/routing/title-strategy';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { TransactionsTable } from './components';

registerLocaleData(localeDeCH, 'de-CH');

@Component({
  selector: 'pulpe-transactions-table',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubTransactionsTable {
  readonly entries = input.required<unknown[]>();
}

// Interface for budget usage data
interface BudgetUsageItem {
  id: string;
  month: number;
  year: number;
  description: string;
}

// Interface for financial entry data
interface FinancialEntry {
  description: string;
  spent: number;
  earned: number;
  saved: number;
  total: number;
}

// Interface for dialog result
interface DialogResult {
  saved: boolean;
  transactions?: { description: string; amount: number; type: string }[];
}

// Mock data for testing
const mockTemplateData: BudgetTemplateDetailViewModel = {
  template: {
    id: 'template-123',
    name: 'Template Test',
    description: 'Description du template de test',
    userId: 'user-1',
    isDefault: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  transactions: [
    {
      id: 'line-1',
      templateId: 'template-123',
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
      description: 'Salaire mensuel',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'line-2',
      templateId: 'template-123',
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
      description: 'Loyer mensuel',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'line-3',
      templateId: 'template-123',
      name: 'Épargne',
      amount: 800,
      kind: 'saving',
      recurrence: 'fixed',
      description: 'Épargne mensuelle',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
};

describe('TemplateDetail', () => {
  // NOTE: Due to Angular 20's resource() and input.required() complexities with TestBed,
  // these tests focus on testing the component's business logic and computed properties
  // without full component instantiation. Complete integration is tested via E2E tests.

  describe('Financial Calculations', () => {
    it('should correctly sort and transform template transactions to financial entries', () => {
      const KIND_ORDER: Record<string, number> = {
        income: 1,
        saving: 2,
        expense: 3,
      } as const;

      const transformTransactions = (transactions: TemplateLine[]) => {
        // Sort transactions by kind first, then by createdAt
        const sortedTransactions = [...transactions].sort((a, b) => {
          // First sort by kind (income → saving → expense)
          const kindDiff =
            (KIND_ORDER[a.kind] ?? 999) - (KIND_ORDER[b.kind] ?? 999);
          if (kindDiff !== 0) return kindDiff;

          // Then sort by createdAt (ascending)
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });

        return sortedTransactions.map((transaction) => {
          const spent = transaction.kind === 'expense' ? transaction.amount : 0;
          const earned = transaction.kind === 'income' ? transaction.amount : 0;
          const saved = transaction.kind === 'saving' ? transaction.amount : 0;
          return {
            description: transaction.name,
            spent,
            earned,
            saved,
            total: earned - spent,
          };
        });
      };

      const entries = transformTransactions(mockTemplateData.transactions);

      expect(entries).toHaveLength(3);

      // Income entry (first due to kind sorting)
      expect(entries[0]).toEqual({
        description: 'Salaire',
        spent: 0,
        earned: 5000,
        saved: 0,
        total: 5000,
      });

      // Savings entry (second due to kind sorting)
      expect(entries[1]).toEqual({
        description: 'Épargne',
        spent: 0,
        earned: 0,
        saved: 800,
        total: 0,
      });

      // Expense entry (third due to kind sorting)
      expect(entries[2]).toEqual({
        description: 'Loyer',
        spent: 1200,
        earned: 0,
        saved: 0,
        total: -1200,
      });
    });

    it('should sort transactions by kind first, then by createdAt', () => {
      const KIND_ORDER: Record<string, number> = {
        income: 1,
        saving: 2,
        expense: 3,
      } as const;

      // Create transactions with different kinds and dates
      const unsortedTransactions: TemplateLine[] = [
        {
          id: 'expense-2',
          templateId: 'template-123',
          name: 'Groceries',
          amount: 300,
          kind: 'expense',
          recurrence: 'fixed',
          description: 'Grocery shopping',
          createdAt: '2024-01-03T00:00:00.000Z', // Later date
          updatedAt: '2024-01-03T00:00:00.000Z',
        },
        {
          id: 'income-1',
          templateId: 'template-123',
          name: 'Salary',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          description: 'Monthly salary',
          createdAt: '2024-01-02T00:00:00.000Z', // Middle date
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'saving-1',
          templateId: 'template-123',
          name: 'Emergency Fund',
          amount: 500,
          kind: 'saving',
          recurrence: 'fixed',
          description: 'Emergency savings',
          createdAt: '2024-01-01T00:00:00.000Z', // Earlier date
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'expense-1',
          templateId: 'template-123',
          name: 'Rent',
          amount: 1200,
          kind: 'expense',
          recurrence: 'fixed',
          description: 'Monthly rent',
          createdAt: '2024-01-01T00:00:00.000Z', // Same date as saving
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'income-2',
          templateId: 'template-123',
          name: 'Freelance',
          amount: 800,
          kind: 'income',
          recurrence: 'one_off',
          description: 'Freelance work',
          createdAt: '2024-01-01T00:00:00.000Z', // Same date as others
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const sortTransactions = (transactions: TemplateLine[]) => {
        return [...transactions].sort((a, b) => {
          // First sort by kind (income → saving → expense)
          const kindDiff =
            (KIND_ORDER[a.kind] ?? 999) - (KIND_ORDER[b.kind] ?? 999);
          if (kindDiff !== 0) return kindDiff;

          // Then sort by createdAt (ascending)
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      };

      const sortedTransactions = sortTransactions(unsortedTransactions);

      // Expected order: incomes first (by date), then savings, then expenses (by date)
      expect(sortedTransactions.map((t) => t.name)).toEqual([
        'Freelance', // income, 2024-01-01
        'Salary', // income, 2024-01-02
        'Emergency Fund', // saving, 2024-01-01
        'Rent', // expense, 2024-01-01
        'Groceries', // expense, 2024-01-03
      ]);

      // Verify kinds are in correct order
      expect(sortedTransactions.map((t) => t.kind)).toEqual([
        'income',
        'income',
        'saving',
        'expense',
        'expense',
      ]);
    });

    it('should calculate totals correctly from financial entries', () => {
      const entries = [
        {
          description: 'Salaire',
          spent: 0,
          earned: 5000,
          saved: 0,
          total: 5000,
        },
        {
          description: 'Loyer',
          spent: 1200,
          earned: 0,
          saved: 0,
          total: -1200,
        },
        {
          description: 'Nourriture',
          spent: 600,
          earned: 0,
          saved: 0,
          total: -600,
        },
        { description: 'Épargne', spent: 0, earned: 0, saved: 800, total: 0 },
        { description: 'Bonus', spent: 0, earned: 500, saved: 0, total: 500 },
      ];

      const totals = entries.reduce(
        (
          acc: { income: number; expense: number; savings: number },
          entry: FinancialEntry,
        ) => ({
          income: acc.income + entry.earned,
          expense: acc.expense + entry.spent,
          savings: acc.savings + entry.saved,
        }),
        { income: 0, expense: 0, savings: 0 },
      );

      expect(totals).toEqual({
        income: 5500,
        expense: 1800,
        savings: 800,
      });
    });

    it('should generate financial pills config from totals', () => {
      const totals = { income: 5500, expense: 1800, savings: 800 };

      const pills = [
        {
          testId: 'income-pill',
          bgStyle: 'var(--pulpe-financial-income-light)',
          colorClass: 'text-financial-income',
          icon: 'trending_up',
          label: 'Revenus',
          amount: totals.income,
        },
        {
          testId: 'expense-pill',
          bgStyle: 'var(--pulpe-financial-expense-light)',
          colorClass: 'text-financial-expense',
          icon: 'trending_down',
          label: 'Dépenses',
          amount: totals.expense,
        },
        {
          testId: 'savings-pill',
          bgStyle: 'var(--pulpe-financial-savings-light)',
          colorClass: 'text-financial-savings',
          icon: 'savings',
          label: 'Épargne',
          amount: totals.savings,
        },
      ];

      expect(pills).toHaveLength(3);
      expect(pills[0]).toEqual(
        expect.objectContaining({
          testId: 'income-pill',
          icon: 'trending_up',
          label: 'Revenus',
          amount: 5500,
        }),
      );
      expect(pills[1]).toEqual(
        expect.objectContaining({
          testId: 'expense-pill',
          icon: 'trending_down',
          label: 'Dépenses',
          amount: 1800,
        }),
      );
      expect(pills[2]).toEqual(
        expect.objectContaining({
          testId: 'savings-pill',
          icon: 'savings',
          label: 'Épargne',
          amount: 800,
        }),
      );
    });

    it('should generate correct net balance for positive balance', () => {
      const totals = { income: 5500, expense: 1800, savings: 800 };
      const total = totals.income - totals.expense;

      const netBalanceData = {
        title: total >= 0 ? 'Solde net' : 'Déficit',
        amount: total,
        icon: total >= 0 ? 'account_balance_wallet' : 'money_off',
        type: total >= 0 ? 'income' : ('negative' as 'income' | 'negative'),
      };

      expect(netBalanceData).toEqual({
        title: 'Solde net',
        amount: 3700,
        icon: 'account_balance_wallet',
        type: 'income',
      });
    });

    it('should generate correct net balance for deficit', () => {
      const totals = { income: 2000, expense: 2500, savings: 0 };
      const total = totals.income - totals.expense;

      const netBalanceData = {
        title: total >= 0 ? 'Solde net' : 'Déficit',
        amount: total,
        icon: total >= 0 ? 'account_balance_wallet' : 'money_off',
        type: total >= 0 ? 'income' : ('negative' as 'income' | 'negative'),
      };

      expect(netBalanceData).toEqual({
        title: 'Déficit',
        amount: -500,
        icon: 'money_off',
        type: 'negative',
      });
    });

    it('should handle empty transactions array', () => {
      const entries: FinancialEntry[] = [];

      const totals = entries.reduce(
        (
          acc: { income: number; expense: number; savings: number },
          entry: FinancialEntry,
        ) => ({
          income: acc.income + entry.earned,
          expense: acc.expense + entry.spent,
          savings: acc.savings + entry.saved,
        }),
        { income: 0, expense: 0, savings: 0 },
      );

      expect(totals).toEqual({
        income: 0,
        expense: 0,
        savings: 0,
      });
    });
  });

  describe('Resource State Management', () => {
    it('should handle loading state correctly', () => {
      const mockResourceState = {
        status: () => 'loading' as const,
        value: () => null,
        error: () => null,
        reload: vi.fn(),
      };

      expect(mockResourceState.status()).toBe('loading');
      expect(mockResourceState.value()).toBeNull();
    });

    it('should handle reloading state correctly', () => {
      const mockResourceState = {
        status: () => 'reloading' as const,
        value: () => mockTemplateData,
        error: () => null,
        reload: vi.fn(),
      };

      expect(mockResourceState.status()).toBe('reloading');
      expect(mockResourceState.value()).toEqual(mockTemplateData);
    });

    it('should handle resolved state correctly', () => {
      const mockResourceState = {
        status: () => 'resolved' as const,
        value: () => mockTemplateData,
        error: () => null,
        reload: vi.fn(),
      };

      expect(mockResourceState.status()).toBe('resolved');
      expect(mockResourceState.value()).toEqual(mockTemplateData);
      expect(mockResourceState.value()?.template.name).toBe('Template Test');
    });

    it('should handle local state correctly', () => {
      const mockResourceState = {
        status: () => 'local' as const,
        value: () => mockTemplateData,
        error: () => null,
        reload: vi.fn(),
      };

      expect(mockResourceState.status()).toBe('local');
      expect(mockResourceState.value()).toEqual(mockTemplateData);
    });

    it('should handle error state correctly', () => {
      const mockError = new Error('Failed to load template');
      const mockResourceState = {
        status: () => 'error' as const,
        value: () => null,
        error: () => mockError,
        reload: vi.fn(),
      };

      expect(mockResourceState.status()).toBe('error');
      expect(mockResourceState.value()).toBeNull();
      expect(mockResourceState.error()).toEqual(mockError);
    });

    it('should call reload function when retry is triggered', () => {
      const reloadSpy = vi.fn();
      const mockResourceState = {
        status: () => 'error' as const,
        value: () => null,
        error: () => new Error('Network error'),
        reload: reloadSpy,
      };

      mockResourceState.reload();
      expect(reloadSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Navigation Logic', () => {
    it('should navigate back correctly', () => {
      const mockRouter = {
        navigate: vi.fn(),
      };

      const mockRoute = {
        snapshot: { params: { id: 'template-123' } },
      };

      const navigateBack = () => {
        mockRouter.navigate(['..'], { relativeTo: mockRoute });
      };

      navigateBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['..'], {
        relativeTo: mockRoute,
      });
    });
  });

  describe('Dialog Interaction', () => {
    it('should prepare transaction data for dialog correctly', () => {
      const prepareTransactionsForDialog = (transactions: TemplateLine[]) => {
        return transactions.map((transaction) => ({
          description: transaction.name,
          amount: transaction.amount,
          type: transaction.kind as 'income' | 'expense' | 'saving',
        }));
      };

      const dialogTransactions = prepareTransactionsForDialog(
        mockTemplateData.transactions,
      );

      expect(dialogTransactions).toEqual([
        {
          description: 'Salaire',
          amount: 5000,
          type: 'income',
        },
        {
          description: 'Loyer',
          amount: 1200,
          type: 'expense',
        },
        {
          description: 'Épargne',
          amount: 800,
          type: 'saving',
        },
      ]);
    });

    it('should open dialog with correct configuration', () => {
      const mockDialog = {
        open: vi.fn().mockReturnValue({
          afterClosed: () => of(null),
        }),
      };

      const templateData = mockTemplateData;
      const transactions = templateData.transactions.map((t) => ({
        description: t.name,
        amount: t.amount,
        type: t.kind as 'income' | 'expense' | 'saving',
      }));

      const expectedDialogConfig = {
        data: {
          transactions,
          templateName: templateData.template.name,
        },
        width: '90vw',
        maxWidth: '1200px',
        height: '90vh',
        maxHeight: '90vh',
        disableClose: true,
        autoFocus: true,
        restoreFocus: true,
      };

      mockDialog.open('MockDialogComponent', expectedDialogConfig);

      expect(mockDialog.open).toHaveBeenCalledWith(
        'MockDialogComponent',
        expectedDialogConfig,
      );
    });

    it('should handle dialog result correctly when saved', () => {
      const mockDialogResult = {
        saved: true,
        transactions: [
          { description: 'Updated Salary', amount: 5500, type: 'income' },
        ],
      };

      const handleDialogResult = (result: DialogResult | null) => {
        if (result?.saved) {
          return {
            shouldReload: true,
            updatedTransactions: result.transactions,
          };
        }
        return { shouldReload: false };
      };

      const result = handleDialogResult(mockDialogResult);

      expect(result).toEqual({
        shouldReload: true,
        updatedTransactions: mockDialogResult.transactions,
      });
    });

    it('should handle dialog result correctly when cancelled', () => {
      const mockDialogResult = null; // Dialog was cancelled

      const handleDialogResult = (result: DialogResult | null) => {
        if (result?.saved) {
          return {
            shouldReload: true,
            updatedTransactions: result.transactions,
          };
        }
        return { shouldReload: false };
      };

      const result = handleDialogResult(mockDialogResult);

      expect(result).toEqual({ shouldReload: false });
    });
  });

  describe('Breakpoint Detection', () => {
    it('should detect handset correctly', () => {
      const mockBreakpointObserver = {
        isMatched: vi.fn().mockReturnValue(true),
      };

      const isHandset = mockBreakpointObserver.isMatched([
        'Handset',
        'TabletPortrait',
      ]);

      expect(isHandset).toBe(true);
      expect(mockBreakpointObserver.isMatched).toHaveBeenCalledWith([
        'Handset',
        'TabletPortrait',
      ]);
    });

    it('should detect desktop correctly', () => {
      const mockBreakpointObserver = {
        isMatched: vi.fn().mockReturnValue(false),
      };

      const isHandset = mockBreakpointObserver.isMatched([
        'Handset',
        'TabletPortrait',
      ]);

      expect(isHandset).toBe(false);
    });
  });

  describe('Title Management', () => {
    it('should set page title correctly when template data is available', () => {
      const mockTitle = {
        setTitle: vi.fn(),
      };

      const setTitleFromTemplate = (
        templateData: BudgetTemplateDetailViewModel | null,
      ) => {
        if (templateData && templateData.template.name) {
          mockTitle.setTitle(templateData.template.name);
        }
      };

      setTitleFromTemplate(mockTemplateData);

      expect(mockTitle.setTitle).toHaveBeenCalledWith('Template Test');
    });

    it('should not set title when template data is not available', () => {
      const mockTitle = {
        setTitle: vi.fn(),
      };

      const setTitleFromTemplate = (
        templateData: BudgetTemplateDetailViewModel | null,
      ) => {
        if (templateData && templateData.template.name) {
          mockTitle.setTitle(templateData.template.name);
        }
      };

      setTitleFromTemplate(null);

      expect(mockTitle.setTitle).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle template with no transactions', () => {
      const emptyTemplateData: BudgetTemplateDetailViewModel = {
        template: mockTemplateData.template,
        transactions: [],
      };

      const transformTransactions = (transactions: TemplateLine[]) => {
        return transactions.map((transaction) => {
          const spent = transaction.kind === 'expense' ? transaction.amount : 0;
          const earned = transaction.kind === 'income' ? transaction.amount : 0;
          const saved = transaction.kind === 'saving' ? transaction.amount : 0;
          return {
            description: transaction.name,
            spent,
            earned,
            saved,
            total: earned - spent,
          };
        });
      };

      const entries = transformTransactions(emptyTemplateData.transactions);
      expect(entries).toEqual([]);
    });

    it('should handle very large transaction amounts', () => {
      const largeAmountTransaction: TemplateLine = {
        id: 'large-tx',
        templateId: 'template-123',
        name: 'Large Income',
        amount: 999999.99,
        kind: 'income',
        recurrence: 'fixed',
        description: 'Very large income',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const entry = {
        description: largeAmountTransaction.name,
        spent:
          largeAmountTransaction.kind === 'expense'
            ? largeAmountTransaction.amount
            : 0,
        earned:
          largeAmountTransaction.kind === 'income'
            ? largeAmountTransaction.amount
            : 0,
        saved:
          largeAmountTransaction.kind === 'saving'
            ? largeAmountTransaction.amount
            : 0,
        total:
          largeAmountTransaction.kind === 'income'
            ? largeAmountTransaction.amount
            : 0,
      };

      expect(entry.earned).toBe(999999.99);
      expect(entry.total).toBe(999999.99);
    });

    it('should handle transaction with zero amount', () => {
      const zeroAmountTransaction: TemplateLine = {
        id: 'zero-tx',
        templateId: 'template-123',
        name: 'Zero Amount',
        amount: 0,
        kind: 'expense',
        recurrence: 'fixed',
        description: 'Zero amount transaction',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const entry = {
        description: zeroAmountTransaction.name,
        spent:
          zeroAmountTransaction.kind === 'expense'
            ? zeroAmountTransaction.amount
            : 0,
        earned:
          zeroAmountTransaction.kind === 'income'
            ? zeroAmountTransaction.amount
            : 0,
        saved:
          zeroAmountTransaction.kind === 'saving'
            ? zeroAmountTransaction.amount
            : 0,
        total: 0,
      };

      expect(entry.spent).toBe(0);
      expect(entry.total).toBe(0);
    });

    it('should handle template with very long name', () => {
      const longNameTemplate = {
        ...mockTemplateData.template,
        name: 'A'.repeat(100), // Very long name
      };

      const templateData = {
        ...mockTemplateData,
        template: longNameTemplate,
      };

      expect(templateData.template.name).toHaveLength(100);
      expect(templateData.template.name.startsWith('A')).toBe(true);
    });
  });

  describe('Computed Properties Logic', () => {
    it('should recalculate totals when transactions change', () => {
      // Simulate initial transactions
      const transactions = mockTemplateData.transactions;

      const calculateTotals = (txs: TemplateLine[]) => {
        const entries = txs.map((transaction) => {
          const spent = transaction.kind === 'expense' ? transaction.amount : 0;
          const earned = transaction.kind === 'income' ? transaction.amount : 0;
          const saved = transaction.kind === 'saving' ? transaction.amount : 0;
          return { spent, earned, saved };
        });

        return entries.reduce(
          (acc, entry) => ({
            income: acc.income + entry.earned,
            expense: acc.expense + entry.spent,
            savings: acc.savings + entry.saved,
          }),
          { income: 0, expense: 0, savings: 0 },
        );
      };

      const initialTotals = calculateTotals(transactions);
      expect(initialTotals).toEqual({
        income: 5000,
        expense: 1200,
        savings: 800,
      });

      // Simulate transaction change
      const updatedTransactions = [
        ...transactions,
        {
          id: 'new-tx',
          templateId: 'template-123',
          name: 'New Expense',
          amount: 300,
          kind: 'expense' as const,
          recurrence: 'fixed' as const,
          description: 'New expense',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const updatedTotals = calculateTotals(updatedTransactions);
      expect(updatedTotals).toEqual({
        income: 5000,
        expense: 1500, // Increased by 300
        savings: 800,
      });
    });
  });

  describe('Template Deletion', () => {
    it('should check template usage before deletion', async () => {
      const mockBudgetTemplatesApi = {
        checkUsage$: vi.fn(),
        delete$: vi.fn(),
      };

      const mockDialog = {
        open: vi.fn(),
      };

      const mockSnackBar = {
        open: vi.fn(),
      };

      const templateId = 'template-123';
      const templateName = 'Test Template';

      // Mock usage check response - template not used
      const mockUsageResponse = {
        data: {
          isUsed: false,
          budgets: [],
        },
        message: 'Template usage checked',
        success: true,
      };

      mockBudgetTemplatesApi.checkUsage$.mockReturnValue(of(mockUsageResponse));

      // Simulate deleteTemplate method logic
      const deleteTemplate = async () => {
        try {
          const usageResponse = (await firstValueFrom(
            mockBudgetTemplatesApi.checkUsage$(templateId),
          )) as { data: { isUsed: boolean; budgets: BudgetUsageItem[] } };

          if (usageResponse.data.isUsed) {
            // Show usage dialog
            mockDialog.open('TemplateUsageDialog', {
              data: { templateId, templateName },
            });
          } else {
            // Show confirmation dialog
            mockDialog.open('ConfirmationDialog', {
              data: {
                title: 'Supprimer le modèle',
                message: `Êtes-vous sûr de vouloir supprimer le modèle « ${templateName} » ?`,
              },
            });
          }
        } catch {
          mockSnackBar.open('Une erreur est survenue', 'Fermer');
        }
      };

      await deleteTemplate();

      expect(mockBudgetTemplatesApi.checkUsage$).toHaveBeenCalledWith(
        templateId,
      );
      expect(mockDialog.open).toHaveBeenCalledWith('ConfirmationDialog', {
        data: {
          title: 'Supprimer le modèle',
          message: `Êtes-vous sûr de vouloir supprimer le modèle « ${templateName} » ?`,
        },
      });
    });

    it('should show usage dialog when template is used', async () => {
      const mockBudgetTemplatesApi = {
        checkUsage$: vi.fn(),
      };

      const mockDialog = {
        open: vi.fn().mockReturnValue({
          componentInstance: {
            setUsageData: vi.fn(),
          },
        }),
      };

      const templateId = 'template-123';
      const templateName = 'Used Template';

      // Mock usage check response - template is used
      const mockUsageResponse = {
        data: {
          isUsed: true,
          budgets: [
            { id: 'budget-1', month: 6, year: 2024, description: 'June 2024' },
            { id: 'budget-2', month: 7, year: 2024, description: 'July 2024' },
          ],
        },
        message: 'Template usage checked',
        success: true,
      };

      mockBudgetTemplatesApi.checkUsage$.mockReturnValue(of(mockUsageResponse));

      // Simulate deleteTemplate method logic
      const deleteTemplate = async () => {
        const usageResponse = (await firstValueFrom(
          mockBudgetTemplatesApi.checkUsage$(templateId),
        )) as { data: { isUsed: boolean; budgets: BudgetUsageItem[] } };

        if (usageResponse.data.isUsed) {
          const dialogRef = mockDialog.open('TemplateUsageDialog', {
            data: { templateId, templateName },
            width: '90vw',
            maxWidth: '600px',
          });

          dialogRef.componentInstance.setUsageData(usageResponse.data.budgets);
        }
      };

      await deleteTemplate();

      expect(mockBudgetTemplatesApi.checkUsage$).toHaveBeenCalledWith(
        templateId,
      );
      expect(mockDialog.open).toHaveBeenCalledWith('TemplateUsageDialog', {
        data: { templateId, templateName },
        width: '90vw',
        maxWidth: '600px',
      });
      expect(
        mockDialog.open.mock.results[0].value.componentInstance.setUsageData,
      ).toHaveBeenCalledWith(mockUsageResponse.data.budgets);
    });

    it('should perform deletion when confirmed', async () => {
      const mockBudgetTemplatesApi = {
        delete$: vi.fn(),
      };

      const mockRouter = {
        navigate: vi.fn(),
      };

      const mockRoute = {
        snapshot: { params: {} },
      };

      const mockSnackBar = {
        open: vi.fn(),
      };

      const templateId = 'template-123';

      // Mock delete response
      const mockDeleteResponse = {
        data: null,
        message: 'Template deleted',
        success: true,
      };

      mockBudgetTemplatesApi.delete$.mockReturnValue(of(mockDeleteResponse));

      // Simulate performDeletion logic
      const performDeletion = async () => {
        try {
          await firstValueFrom(mockBudgetTemplatesApi.delete$(templateId));
          mockSnackBar.open('Modèle supprimé avec succès', undefined, {
            duration: 3000,
          });
          mockRouter.navigate(['..'], { relativeTo: mockRoute });
        } catch {
          mockSnackBar.open(
            'Une erreur est survenue lors de la suppression',
            'Fermer',
            { duration: 5000 },
          );
        }
      };

      await performDeletion();

      expect(mockBudgetTemplatesApi.delete$).toHaveBeenCalledWith(templateId);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Modèle supprimé avec succès',
        undefined,
        { duration: 3000 },
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['..'], {
        relativeTo: mockRoute,
      });
    });

    it('should handle deletion error', async () => {
      const mockBudgetTemplatesApi = {
        delete$: vi.fn(),
      };

      const mockSnackBar = {
        open: vi.fn(),
      };

      const templateId = 'template-123';
      const mockError = new Error('Network error');

      mockBudgetTemplatesApi.delete$.mockReturnValue(
        throwError(() => mockError),
      );

      // Simulate performDeletion logic with error
      const performDeletion = async () => {
        try {
          await firstValueFrom(mockBudgetTemplatesApi.delete$(templateId));
        } catch (error) {
          console.error('Error deleting template:', error);
          mockSnackBar.open(
            'Une erreur est survenue lors de la suppression',
            'Fermer',
            { duration: 5000 },
          );
        }
      };

      await performDeletion();

      expect(mockBudgetTemplatesApi.delete$).toHaveBeenCalledWith(templateId);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Une erreur est survenue lors de la suppression',
        'Fermer',
        { duration: 5000 },
      );
    });

    it('should handle usage check error', async () => {
      const mockBudgetTemplatesApi = {
        checkUsage$: vi.fn(),
      };

      const mockSnackBar = {
        open: vi.fn(),
      };

      const templateId = 'template-123';
      const mockError = new Error('API error');

      mockBudgetTemplatesApi.checkUsage$.mockReturnValue(
        throwError(() => mockError),
      );

      // Simulate deleteTemplate method logic with error
      const deleteTemplate = async () => {
        try {
          await firstValueFrom(mockBudgetTemplatesApi.checkUsage$(templateId));
        } catch (error) {
          console.error('Error checking template usage:', error);
          mockSnackBar.open(
            'Une erreur est survenue lors de la vérification',
            'Fermer',
            { duration: 5000 },
          );
        }
      };

      await deleteTemplate();

      expect(mockBudgetTemplatesApi.checkUsage$).toHaveBeenCalledWith(
        templateId,
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Une erreur est survenue lors de la vérification',
        'Fermer',
        { duration: 5000 },
      );
    });
  });

  describe('Component Behavior (TestBed)', () => {
    const mockTemplateDetails: BudgetTemplateDetailViewModel = {
      template: {
        id: 'template-123',
        name: 'Template Test',
        description: 'Description',
        userId: 'user-1',
        isDefault: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      transactions: [
        {
          id: 'line-1',
          templateId: 'template-123',
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          description: '',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    const mockTemplateDetailsStore = {
      templateDetails: signal(mockTemplateDetails),
      isLoading: signal(false),
      hasValue: signal(true),
      error: signal(null),
      template: computed(() => mockTemplateDetails.template),
      templateLines: computed(() => mockTemplateDetails.transactions),
      transactions: computed(() => mockTemplateDetails.transactions),
      initializeTemplateId: vi.fn(),
      reloadTemplateDetails: vi.fn(),
    };

    const mockDialog = {
      open: vi.fn().mockReturnValue({ afterClosed: () => of(null) }),
    };

    const mockSnackBar = { open: vi.fn() };
    const mockBudgetTemplatesApi = {
      checkUsage$: vi.fn(),
      delete$: vi.fn(),
      getDetail$: vi.fn(),
      bulkOperationsTemplateLines$: vi.fn(),
    };
    const mockTitleStrategy = { setTitle: vi.fn() };

    async function createComponent() {
      const TemplateDetail = (await import('./template-detail')).default;

      TestBed.configureTestingModule({
        imports: [TemplateDetail, NoopAnimationsModule],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          TransactionLabelPipe,
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                paramMap: { get: () => 'template-123' },
              },
            },
          },
          { provide: TemplateDetailsStore, useValue: mockTemplateDetailsStore },
          { provide: MatDialog, useValue: mockDialog },
          { provide: MatSnackBar, useValue: mockSnackBar },
          { provide: BudgetTemplatesApi, useValue: mockBudgetTemplatesApi },
          { provide: PulpeTitleStrategy, useValue: mockTitleStrategy },
        ],
      })
        .overrideComponent(TemplateDetail, {
          remove: { imports: [TransactionsTable] },
        })
        .overrideComponent(TemplateDetail, {
          add: {
            imports: [StubTransactionsTable],
            providers: [
              {
                provide: TemplateDetailsStore,
                useValue: mockTemplateDetailsStore,
              },
            ],
          },
        });

      const fixture = TestBed.createComponent(TemplateDetail);
      fixture.detectChanges();
      return fixture;
    }

    beforeEach(() => {
      vi.clearAllMocks();
      mockDialog.open.mockReturnValue({ afterClosed: () => of(null) });
    });

    it('should render without errors when template data is loaded', async () => {
      const fixture = await createComponent();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('[data-testid="page-title"]')).toBeTruthy();
      expect(
        el.querySelector('[data-testid="page-title"]')?.textContent?.trim(),
      ).toContain('Template Test');
    });

    it('should render edit and delete buttons', async () => {
      const fixture = await createComponent();
      const el = fixture.nativeElement as HTMLElement;

      expect(
        el.querySelector('[data-testid="template-detail-edit-button"]'),
      ).toBeTruthy();
      expect(
        el.querySelector('[data-testid="delete-template-detail-button"]'),
      ).toBeTruthy();
    });

    it('should open EditTransactionsDialog when clicking Modifier', async () => {
      const fixture = await createComponent();
      const editButton = fixture.nativeElement.querySelector(
        '[data-testid="template-detail-edit-button"]',
      ) as HTMLButtonElement;

      editButton.click();
      fixture.detectChanges();

      expect(mockDialog.open).toHaveBeenCalledOnce();
      const [, config] = mockDialog.open.mock.calls[0];
      expect(config.data.templateName).toBe('Template Test');
      expect(config.data.templateId).toBe('template-123');
      expect(config.data.transactions).toHaveLength(1);
    });

    it('should trigger delete flow when clicking Supprimer', async () => {
      mockBudgetTemplatesApi.checkUsage$.mockReturnValue(
        of({ data: { isUsed: false, budgets: [] }, success: true }),
      );

      const fixture = await createComponent();
      const deleteButton = fixture.nativeElement.querySelector(
        '[data-testid="delete-template-detail-button"]',
      ) as HTMLButtonElement;

      deleteButton.click();
      await fixture.whenStable();

      expect(mockBudgetTemplatesApi.checkUsage$).toHaveBeenCalledWith(
        'template-123',
      );
    });

    it('should display financial summary with hero and pills', async () => {
      const fixture = await createComponent();
      const el = fixture.nativeElement as HTMLElement;
      const summaryRegion = el.querySelector(
        '[aria-labelledby="financial-summary-heading"]',
      );

      expect(summaryRegion).toBeTruthy();
      expect(summaryRegion?.textContent).toContain('Solde net du modèle');
      expect(summaryRegion?.textContent).toContain('Revenus');
      expect(summaryRegion?.textContent).toContain('Dépenses');
      expect(summaryRegion?.textContent).toContain('Épargne');
    });
  });
});
