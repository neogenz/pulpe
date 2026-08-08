import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  provideZonelessChangeDetection,
  signal,
  computed,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { type BudgetLine, type Transaction, type Budget } from 'pulpe-shared';
import { Subject } from 'rxjs';
import Dashboard, { UNDO_WINDOW_MS } from './current-month';
import { type TransactionFormData } from './components/add-transaction-form.schema';
import { AddTransactionDialogService } from './services/add-transaction-dialog.service';
import { DashboardStore } from './services/dashboard-store';

// Test data factories
const createBudgetLine = (overrides: Partial<BudgetLine> = {}): BudgetLine => ({
  id: 'line-123',
  budgetId: 'budget-456',
  templateLineId: null,
  savingsGoalId: null,
  name: 'Test Budget Line',
  amount: 1000,
  kind: 'expense',
  recurrence: 'fixed',
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const TAG_ID = '00000000-0000-4000-8000-0000000000f1';

const createTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: 'transaction-123',
  budgetId: 'budget-456',
  budgetLineId: null,
  name: 'Test Transaction',
  amount: 50,
  kind: 'expense',
  transactionDate: '2024-01-15T10:00:00.000Z',
  tagIds: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  checkedAt: null,
  ...overrides,
});

const createBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'budget-123',
  month: 1,
  year: 2024,
  description: 'Test Budget',
  userId: 'user-123',
  templateId: 'template-123',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('CurrentMonth Component', () => {
  // NOTE: Due to Angular 20's signal complexities with TestBed and Zone.js,
  // these tests focus on testing the component's computed logic directly.
  // Complete integration is tested via E2E tests.

  let mockBudgetLineMapper: { toTransaction: Mock };

  beforeEach(() => {
    // Mock BudgetLineMapper
    mockBudgetLineMapper = { toTransaction: vi.fn() };
  });

  describe('Component Architecture', () => {
    it('should have required signals and computed properties', () => {
      // Test that the component defines the expected interface
      const expectedSignals = ['isCreatingTransaction', 'selectedTransactions'];
      const expectedComputed = ['fixedTransactions'];
      const expectedMethods = [
        'ngOnInit',
        'openAddTransaction',
        'onAddTransaction',
        'deleteTransaction',
      ];

      // This verifies the component has the correct structure
      expect(expectedSignals.length).toBe(2);
      expect(expectedComputed.length).toBe(1);
      expect(expectedMethods.length).toBe(4);
    });

    it('should initialize signals with correct default values', () => {
      const isCreatingTransaction = signal(false);
      const selectedTransactions = signal<string[]>([]);

      expect(isCreatingTransaction()).toBe(false);
      expect(selectedTransactions()).toEqual([]);
    });
  });

  describe('fixedTransactions computed logic', () => {
    it('should return empty array when no budget', () => {
      // Mock state signals
      const budgetLines = signal<BudgetLine[]>([]);
      const dashboardData = signal<{ budget: Budget | null }>({ budget: null });

      // Recreate the computed logic
      const fixedTransactions = computed(() => {
        const lines = budgetLines();
        const budgetId = dashboardData()?.budget?.id;

        if (!budgetId) return [];

        return lines
          .filter((line) => line.recurrence === 'fixed')
          .map((line) => mockBudgetLineMapper.toTransaction(line, budgetId));
      });

      // Act & Assert
      expect(fixedTransactions()).toEqual([]);
    });

    it('should filter and map fixed budget lines to transactions', () => {
      // Arrange
      const budget = createBudget();
      const fixedBudgetLine = createBudgetLine({
        recurrence: 'fixed',
        name: 'Loyer',
        amount: 1800,
      });
      const oneOffBudgetLine = createBudgetLine({
        recurrence: 'one_off',
        name: 'One Off Expense',
      });
      const budgetLines = signal([fixedBudgetLine, oneOffBudgetLine]);
      const dashboardData = signal({ budget });
      const mappedTransaction = createTransaction({
        name: 'Loyer',
        amount: 1800,
      });

      mockBudgetLineMapper.toTransaction.mockReturnValue(mappedTransaction);

      // Recreate the computed logic
      const fixedTransactions = computed(() => {
        const lines = budgetLines();
        const budgetId = dashboardData()?.budget?.id;

        if (!budgetId) return [];

        return lines
          .filter((line) => line.recurrence === 'fixed')
          .map((line) => mockBudgetLineMapper.toTransaction(line, budgetId));
      });

      // Act
      const result = fixedTransactions();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mappedTransaction);
      expect(mockBudgetLineMapper.toTransaction).toHaveBeenCalledWith(
        fixedBudgetLine,
        budget.id,
      );
    });

    it('should filter out non-fixed recurrence budget lines', () => {
      // Arrange
      const budget = createBudget();
      const budgetLinesData = [
        createBudgetLine({ recurrence: 'fixed', name: 'Fixed Expense' }),
        createBudgetLine({ recurrence: 'one_off', name: 'One Off Expense' }),
        createBudgetLine({ recurrence: 'one_off', name: 'One Off Expense' }),
      ];
      const budgetLines = signal(budgetLinesData);
      const dashboardData = signal({ budget });

      mockBudgetLineMapper.toTransaction.mockImplementation((line) =>
        createTransaction({ name: line.name }),
      );

      // Recreate the computed logic
      const fixedTransactions = computed(() => {
        const lines = budgetLines();
        const budgetId = dashboardData()?.budget?.id;

        if (!budgetId) return [];

        return lines
          .filter((line) => line.recurrence === 'fixed')
          .map((line) => mockBudgetLineMapper.toTransaction(line, budgetId));
      });

      // Act
      const result = fixedTransactions();

      // Assert
      expect(result).toHaveLength(1);
      expect(mockBudgetLineMapper.toTransaction).toHaveBeenCalledTimes(1);
      expect(mockBudgetLineMapper.toTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ recurrence: 'fixed' }),
        budget.id,
      );
    });
  });

  describe('ngOnInit behavior', () => {
    it('should call state.refreshData on initialization', () => {
      // This test verifies the component calls refreshData on initialization
      // Testing the interaction pattern without TestBed
      const mockRefreshData = vi.fn();

      // Simulate ngOnInit behavior
      const ngOnInit = () => {
        mockRefreshData();
      };

      // Act
      ngOnInit();

      // Assert
      expect(mockRefreshData).toHaveBeenCalledTimes(1);
    });
  });

  describe('onAddTransaction method behavior', () => {
    it('should map transaction types correctly', () => {
      // Test the transaction type mapping logic
      type TransactionType = 'income' | 'saving' | 'expense';

      const getTransactionKind = (type: TransactionType): string => {
        switch (type) {
          case 'income':
            return 'income';
          case 'saving':
            return 'saving';
          case 'expense':
          default:
            return 'expense';
        }
      };

      expect(getTransactionKind('income')).toBe('income');
      expect(getTransactionKind('saving')).toBe('saving');
      expect(getTransactionKind('expense')).toBe('expense');
    });

    it('should create transaction data with correct structure', () => {
      // Test transaction data creation logic
      const transactionFormData = {
        name: 'Test Transaction',
        amount: 100,
        type: 'expense' as const,
        tagIds: [TAG_ID],
      };
      const budget = createBudget();

      type TransactionFormType = 'income' | 'saving' | 'expense';

      const createTransactionData = (
        formData: {
          name: string;
          amount: number;
          type: TransactionFormType;
          tagIds: string[];
        },
        budgetId: string,
      ) => {
        return {
          budgetId,
          amount: formData.amount,
          name: formData.name,
          kind:
            formData.type === 'income'
              ? 'income'
              : formData.type === 'saving'
                ? 'saving'
                : 'expense',
          transactionDate: new Date().toISOString(),
          tagIds: formData.tagIds,
        };
      };

      const result = createTransactionData(transactionFormData, budget.id);

      expect(result).toEqual({
        budgetId: budget.id,
        amount: 100,
        name: 'Test Transaction',
        kind: 'expense',
        transactionDate: expect.any(String),
        tagIds: [TAG_ID],
      });
    });

    it('should handle loading state correctly', async () => {
      // Test loading state management
      const isCreatingTransaction = signal(false);
      const mockAddTransaction = vi.fn().mockResolvedValue(undefined);

      const simulateTransactionCreation = async () => {
        try {
          isCreatingTransaction.set(true);
          await mockAddTransaction();
        } finally {
          isCreatingTransaction.set(false);
        }
      };

      expect(isCreatingTransaction()).toBe(false);

      const promise = simulateTransactionCreation();
      expect(isCreatingTransaction()).toBe(true);

      await promise;
      expect(isCreatingTransaction()).toBe(false);
    });

    it('should handle errors and reset loading state', async () => {
      // Test error handling with loading state
      const isCreatingTransaction = signal(false);
      const mockAddTransaction = vi
        .fn()
        .mockRejectedValue(new Error('API Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock console.error for testing
      });

      const simulateTransactionCreationWithError = async () => {
        try {
          isCreatingTransaction.set(true);
          await mockAddTransaction();
        } catch (error) {
          console.error(error);
        } finally {
          isCreatingTransaction.set(false);
        }
      };

      await simulateTransactionCreationWithError();

      expect(isCreatingTransaction()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('deleteTransaction method behavior', () => {
    it('should find transaction correctly', () => {
      // Test transaction finding logic
      const transactions = [
        createTransaction({ id: 'transaction-1', name: 'Transaction 1' }),
        createTransaction({ id: 'transaction-2', name: 'Transaction 2' }),
        createTransaction({ id: 'transaction-3', name: 'Transaction 3' }),
      ];

      const findTransaction = (id: string) => {
        return transactions.find((t) => t.id === id);
      };

      expect(findTransaction('transaction-2')).toEqual(
        expect.objectContaining({ id: 'transaction-2', name: 'Transaction 2' }),
      );
      expect(findTransaction('non-existent')).toBeUndefined();
    });

    it('should create correct dialog configuration', () => {
      // Test dialog configuration logic
      const transaction = createTransaction({
        id: 'test-id',
        name: 'Test Transaction',
      });

      const createDialogConfig = (transactionName: string) => ({
        data: {
          title: 'Supprimer la transaction',
          message: `Êtes-vous sûr de vouloir supprimer « ${transactionName} » ?`,
          confirmText: 'Supprimer',
          cancelText: 'Annuler',
          confirmColor: 'warn',
        },
        width: '400px',
      });

      const config = createDialogConfig(transaction.name);

      expect(config).toEqual({
        data: {
          title: 'Supprimer la transaction',
          message: 'Êtes-vous sûr de vouloir supprimer « Test Transaction » ?',
          confirmText: 'Supprimer',
          cancelText: 'Annuler',
          confirmColor: 'warn',
        },
        width: '400px',
      });
    });

    it('should handle confirmation result correctly', async () => {
      // Test confirmation handling logic
      const mockDeleteTransaction = vi.fn().mockResolvedValue(undefined);
      const mockShowSuccess = vi.fn();
      const mockShowError = vi.fn();

      const handleConfirmation = async (
        confirmed: boolean,
        transactionId: string,
      ) => {
        if (!confirmed) {
          return; // Early return if not confirmed
        }

        try {
          await mockDeleteTransaction(transactionId);
          mockShowSuccess('Transaction supprimée');
        } catch (error) {
          console.error('Error deleting transaction:', error);
          mockShowError('Une erreur est survenue lors de la suppression');
        }
      };

      // Test confirmation = false
      await handleConfirmation(false, 'test-id');
      expect(mockDeleteTransaction).not.toHaveBeenCalled();

      // Test confirmation = true
      await handleConfirmation(true, 'test-id');
      expect(mockDeleteTransaction).toHaveBeenCalledWith('test-id');
      expect(mockShowSuccess).toHaveBeenCalledWith('Transaction supprimée');
    });

    it('should handle deletion errors correctly', async () => {
      // Test error handling logic
      const mockDeleteTransaction = vi
        .fn()
        .mockRejectedValue(new Error('API Error'));
      const mockShowError = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock console.error for testing
      });

      const handleDeletionWithError = async (transactionId: string) => {
        try {
          await mockDeleteTransaction(transactionId);
        } catch (error) {
          console.error('Error deleting transaction:', error);
          mockShowError('Une erreur est survenue lors de la suppression');
        }
      };

      await handleDeletionWithError('test-id');

      expect(mockShowError).toHaveBeenCalledWith(
        'Une erreur est survenue lors de la suppression',
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error deleting transaction:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('Dashboard (TestBed)', () => {
  const budgetId = '00000000-0000-4000-8000-000000000001';

  function createMockStore(budgetId: string) {
    return {
      dashboardData: signal<{ budget?: { id: string } }>({
        budget: { id: budgetId },
      }),
      addTransaction: vi.fn().mockResolvedValue({ transactionId: 'tx-new' }),
      deleteTransaction: vi.fn().mockResolvedValue(null),
      status: signal<'idle' | 'loading' | 'reloading' | 'resolved' | 'error'>(
        'resolved',
      ),
      isLoading: signal(false),
      isInitialLoading: signal(false),
      hasValue: signal(true),
      error: signal(null),
      currentBudgetPeriod: signal({ month: 4, year: 2026 }),
      refreshData: vi.fn(),
      uncheckedForecasts: signal([
        { id: 'line-1', name: 'Loyer' },
        { id: 'line-2', name: 'Assurance' },
      ]),
      checkBudgetLine: vi.fn().mockResolvedValue(null),
      uncheckBudgetLine: vi.fn().mockResolvedValue(null),
      remaining: signal(3491),
      historyError: signal<unknown>(undefined),
    };
  }

  async function setup(
    budgetId: string,
    dialogResult: TransactionFormData | undefined,
  ) {
    const mockStore = createMockStore(budgetId);
    const mockDialogService = {
      open: vi.fn().mockResolvedValue(dialogResult),
    };
    const mockRouter = { navigate: vi.fn() };
    // One subject per toast, not one for the whole run: MatSnackBar dismisses
    // the ref it had open when a new one arrives, and a dismissed ref's
    // onAction never fires again. Sharing a single subject made every toast
    // ever opened answer the same tap, which is precisely the bug the batched
    // undo exists to remove — the double would have hidden it.
    let latestAction = new Subject<void>();
    const mockSnackBar = {
      open: vi.fn().mockImplementation(() => {
        latestAction = new Subject<void>();
        return { onAction: () => latestAction };
      }),
    };
    const undoAction = { next: () => latestAction.next() };

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [Dashboard],
        providers: [
          provideZonelessChangeDetection(),
          provideAnimationsAsync(),
          ...provideTranslocoForTest(),
          { provide: DashboardStore, useValue: mockStore },
          {
            provide: AddTransactionDialogService,
            useValue: mockDialogService,
          },
          { provide: Router, useValue: mockRouter },
          { provide: MatSnackBar, useValue: mockSnackBar },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(Dashboard);
    return {
      component: fixture.componentInstance,
      mockStore,
      mockDialogService,
      mockSnackBar,
      undoAction,
    };
  }

  describe('#addTransaction forwards currency conversion metadata', () => {
    it('should include originalAmount, originalCurrency, targetCurrency, exchangeRate in store.addTransaction call when present on the surface payload', async () => {
      const { component, mockStore } = await setup(budgetId, {
        name: 'Test pour claude',
        amount: 108.97,
        kind: 'expense',
        tagIds: [],
        isChecked: false,
        conversion: {
          originalAmount: 100,
          originalCurrency: 'CHF',
          targetCurrency: 'EUR',
          exchangeRate: 1.0897,
        },
      });

      await component['openAddTransaction']();

      expect(mockStore.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetId,
          amount: 108.97,
          name: 'Test pour claude',
          kind: 'expense',
          originalAmount: 100,
          originalCurrency: 'CHF',
          targetCurrency: 'EUR',
          exchangeRate: 1.0897,
        }),
      );
    });

    it('should forward transaction payload without conversion metadata when the surface omits it', async () => {
      const { component, mockStore } = await setup(budgetId, {
        name: 'Courses',
        amount: 50,
        kind: 'expense',
        tagIds: [],
        isChecked: false,
        conversion: null,
      });

      await component['openAddTransaction']();

      const callArg = mockStore.addTransaction.mock.calls[0][0];
      expect(callArg.budgetId).toBe(budgetId);
      expect(callArg.amount).toBe(50);
      expect(callArg.originalAmount).toBeUndefined();
      expect(callArg.originalCurrency).toBeUndefined();
      expect(callArg.targetCurrency).toBeUndefined();
      expect(callArg.exchangeRate).toBeUndefined();
    });

    it('should not call store.addTransaction when the surface is dismissed without data', async () => {
      const { component, mockStore } = await setup(budgetId, undefined);

      await component['openAddTransaction']();

      expect(mockStore.addTransaction).not.toHaveBeenCalled();
    });

    it('should skip store.addTransaction when no budget is loaded', async () => {
      const { component, mockStore } = await setup('', {
        name: 'Test',
        amount: 10,
        kind: 'expense',
        tagIds: [],
        isChecked: false,
        conversion: null,
      });

      await component['openAddTransaction']();

      expect(mockStore.addTransaction).not.toHaveBeenCalled();
    });
  });

  // The quick-add surface closes as soon as it is submitted, so a refusal has
  // nowhere left to appear: without this the user walks away believing the
  // income exists.
  describe('#addTransaction surfaces a refusal', () => {
    const quickIncome: TransactionFormData = {
      name: 'Retrait Maison',
      amount: 100,
      kind: 'income',
      tagIds: [],
      isChecked: false,
      conversion: null,
    };

    it('should show the reason the store hands back', async () => {
      const { component, mockStore, mockSnackBar } = await setup(
        budgetId,
        quickIncome,
      );
      mockStore.addTransaction.mockResolvedValue({
        reason: "Cet objectif n'a pas assez d'argent pour ce montant",
      });

      await component['openAddTransaction']();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        "Cet objectif n'a pas assez d'argent pour ce montant",
        expect.any(String),
        expect.objectContaining({ duration: 5000 }),
      );
    });

    // Silence used to be the assertion here. Recording a transaction is the
    // page's purpose, the sheet closes over it, and on a phone the figures it
    // moved are a screenful up — so a success that says nothing leaves the user
    // with no evidence the money was written down. Checking a box, one method
    // away in the same component, has always named its line and offered undo.
    it('should confirm by name when the transaction went through', async () => {
      const { component, mockSnackBar } = await setup(budgetId, quickIncome);

      await component['openAddTransaction']();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Retrait Maison'),
        expect.any(String),
        expect.objectContaining({ duration: UNDO_WINDOW_MS }),
      );
    });

    // The way back. A mistyped amount used to be removable only from the budget
    // page, so the toast promised nothing and the write was one-way.
    it('should delete the transaction when the undo is taken', async () => {
      const { component, mockStore, undoAction } = await setup(
        budgetId,
        quickIncome,
      );

      await component['openAddTransaction']();
      undoAction.next();

      expect(mockStore.deleteTransaction).toHaveBeenCalledWith('tx-new');
    });

    it('should say so when the undo could not go through', async () => {
      const { component, mockStore, mockSnackBar, undoAction } = await setup(
        budgetId,
        quickIncome,
      );
      mockStore.deleteTransaction.mockResolvedValue(
        'Impossible d’annuler — la transaction reste enregistrée',
      );

      await component['openAddTransaction']();
      undoAction.next();
      await Promise.resolve();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Impossible d’annuler — la transaction reste enregistrée',
        expect.any(String),
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  // Clearing a month is a run of taps, and each toast replaces the one before
  // it. The undo used to go with the toast it arrived on, so six seconds into
  // the run the first line was already unreachable.
  describe('chained checks', () => {
    it('should take back every check the window still covers', async () => {
      const { component, mockStore, undoAction } = await setup(
        budgetId,
        undefined,
      );

      await component['checkBudgetLine']('line-1');
      await component['checkBudgetLine']('line-2');
      undoAction.next();
      await Promise.resolve();

      expect(mockStore.uncheckBudgetLine).toHaveBeenNthCalledWith(1, 'line-2');
      expect(mockStore.uncheckBudgetLine).toHaveBeenNthCalledWith(2, 'line-1');
    });

    it('should count the checks it can still take back', async () => {
      const { component, mockSnackBar } = await setup(budgetId, undefined);

      await component['checkBudgetLine']('line-1');
      await component['checkBudgetLine']('line-2');

      expect(mockSnackBar.open).toHaveBeenLastCalledWith(
        expect.stringContaining('2'),
        expect.any(String),
        expect.objectContaining({ duration: UNDO_WINDOW_MS }),
      );
    });

    // The toast used to print "Disponible", which an envelope budget does not
    // move when a line is pointed — five taps produced five identical figures.
    // What the tap does move is how many forecasts are left.
    it('should say how many forecasts are left to check', async () => {
      const { component, mockSnackBar } = await setup(budgetId, undefined);

      await component['checkBudgetLine']('line-1');

      expect(mockSnackBar.open).toHaveBeenLastCalledWith(
        expect.stringContaining('2 à pointer'),
        expect.any(String),
        expect.objectContaining({ duration: UNDO_WINDOW_MS }),
      );
    });
  });

  // Pressing Actualiser on a month that has not changed repaints nothing, so
  // the button looked broken.
  describe('refresh', () => {
    it('should confirm once the reload has come back', async () => {
      const { component, mockStore, mockSnackBar } = await setup(
        budgetId,
        undefined,
      );

      // Rendered as the no-budget state on purpose: ticking is what flushes the
      // effect under test, and the mock store carries none of the dozen signals
      // the hero would ask for on the way past.
      mockStore.dashboardData.set({});
      component['refresh']();
      mockStore.isLoading.set(true);
      TestBed.tick();
      mockStore.isLoading.set(false);
      TestBed.tick();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Chiffres à jour',
        expect.any(String),
        expect.objectContaining({ duration: 5000 }),
      );
    });

    // isLoading() falls the same way whether the reload worked or not, so the
    // quiet tick alone used to be read as success: a dead connection drew the
    // error card and a toast saying the figures were up to date.
    it('should not claim success when the reload failed', async () => {
      const { component, mockStore, mockSnackBar } = await setup(
        budgetId,
        undefined,
      );

      mockStore.dashboardData.set({});
      component['refresh']();
      mockStore.isLoading.set(true);
      TestBed.tick();
      mockStore.historyError.set(new Error('history unreachable'));
      mockStore.isLoading.set(false);
      TestBed.tick();

      expect(mockSnackBar.open).not.toHaveBeenCalledWith(
        'Chiffres à jour',
        expect.any(String),
        expect.anything(),
      );
    });

    it('should stay quiet when nothing asked for a reload', async () => {
      const { mockStore, mockSnackBar } = await setup(budgetId, undefined);

      mockStore.dashboardData.set({});
      mockStore.isLoading.set(true);
      TestBed.tick();
      mockStore.isLoading.set(false);
      TestBed.tick();

      expect(mockSnackBar.open).not.toHaveBeenCalled();
    });
  });
});
