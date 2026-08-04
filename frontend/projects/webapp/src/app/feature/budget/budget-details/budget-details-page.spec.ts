import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DestroyRef,
  effect,
  signal,
  provideZonelessChangeDetection,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { BreadcrumbState } from '@core/shell/breadcrumb-state';
import { UserSettingsStore } from '@core/user-settings';
import { createMockTransaction } from '@app/testing/mock-factories';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import BudgetDetailsPage from './budget-details-page';
import { BudgetDetailsDialogService } from './budget-details-dialog.service';
import { BudgetDetailsStore } from './store/budget-details-store';

/**
 * Tests the loading indicator ↔ isStale contract used by BudgetDetailsPage.
 *
 * The production component (budget-details-page.ts:180-187) wires:
 *   effect(() => this.#loadingIndicator.setLoading(this.store.isStale()));
 *   destroyRef.onDestroy(() => this.#loadingIndicator.setLoading(false));
 *
 * We test this contract in isolation because the component uses templateUrl
 * which is not resolved by the vitest setup (no Angular vite plugin).
 */
describe('BudgetDetailsPage — loading indicator contract', () => {
  let loadingIndicator: LoadingIndicator;
  let isStale: ReturnType<typeof signal<boolean>>;
  let destroyRef: DestroyRef;

  beforeEach(() => {
    isStale = signal(false);

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });

    loadingIndicator = TestBed.inject(LoadingIndicator);
    destroyRef = TestBed.inject(DestroyRef);

    TestBed.runInInjectionContext(() => {
      effect(() => {
        loadingIndicator.setLoading(isStale());
      });

      destroyRef.onDestroy(() => {
        loadingIndicator.setLoading(false);
      });
    });

    TestBed.flushEffects();
  });

  it('should not show loading bar when budget data is fresh', () => {
    expect(loadingIndicator.isLoading()).toBe(false);
  });

  it('should show loading bar when budget data becomes stale', () => {
    isStale.set(true);
    TestBed.flushEffects();

    expect(loadingIndicator.isLoading()).toBe(true);
  });

  it('should hide loading bar when stale data is refreshed', () => {
    isStale.set(true);
    TestBed.flushEffects();

    isStale.set(false);
    TestBed.flushEffects();

    expect(loadingIndicator.isLoading()).toBe(false);
  });
});

/**
 * PUL-329 — arriving from a savings goal's "Retraits" section carries the
 * targeted transaction in a query param. The template stays empty here: the
 * behaviour under test lives entirely in the page's constructor effect.
 */
describe('BudgetDetailsPage — savings-goal deep link', () => {
  const BUDGET_ID = '00000000-0000-4000-8000-000000000100';
  const TRANSACTION_ID = '00000000-0000-4000-8000-000000000200';

  const openEditAllocatedTransactionDialog = vi.fn();
  const updateTransaction = vi.fn();
  const navigate = vi.fn();
  let budgetDetails: ReturnType<typeof signal<unknown>>;

  function createPage(): BudgetDetailsPage {
    TestBed.overrideComponent(BudgetDetailsPage, {
      set: {
        template: '',
        templateUrl: undefined,
        providers: [
          {
            provide: BudgetDetailsStore,
            useValue: {
              setBudgetId: vi.fn(),
              isStale: signal(false),
              budgetDetails,
              financialTotals: signal(null),
              savingsWithdrawalDeficit: signal(0),
              previousBudgetId: signal(null),
              nextBudgetId: signal(null),
              updateTransaction,
            },
          },
          {
            provide: BudgetDetailsDialogService,
            useValue: { openEditAllocatedTransactionDialog },
          },
        ],
      },
    });

    const fixture = TestBed.createComponent(BudgetDetailsPage);
    setTestInput(fixture.componentInstance.id, BUDGET_ID);
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    openEditAllocatedTransactionDialog.mockResolvedValue(undefined);
    budgetDetails = signal<unknown>(null);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: {} },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        {
          provide: BreadcrumbState,
          useValue: {
            setDynamicBreadcrumb: vi.fn(),
            clearDynamicBreadcrumb: vi.fn(),
          },
        },
        {
          provide: UserSettingsStore,
          useValue: { currency: signal('CHF'), payDayOfMonth: signal(25) },
        },
      ],
    });
  });

  function loadBudget(): void {
    budgetDetails.set({
      id: BUDGET_ID,
      month: 7,
      year: 2026,
      transactions: [
        createMockTransaction({ id: TRANSACTION_ID, name: 'Apport cuisine' }),
      ],
    });
  }

  it('waits for the budget then opens the targeted transaction exactly once', () => {
    const page = createPage();
    setTestInput(page.transactionId, TRANSACTION_ID);
    TestBed.flushEffects();

    expect(openEditAllocatedTransactionDialog).not.toHaveBeenCalled();

    loadBudget();
    TestBed.flushEffects();

    expect(openEditAllocatedTransactionDialog).toHaveBeenCalledTimes(1);
    expect(openEditAllocatedTransactionDialog.mock.calls[0][0].id).toBe(
      TRANSACTION_ID,
    );

    budgetDetails.update((details) => ({ ...(details as object) }));
    TestBed.flushEffects();

    expect(openEditAllocatedTransactionDialog).toHaveBeenCalledTimes(1);
  });

  it('consumes the query param through a replaced history entry', () => {
    const page = createPage();
    setTestInput(page.transactionId, TRANSACTION_ID);
    loadBudget();
    TestBed.flushEffects();

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { transactionId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('clears the query param without a dialog when the transaction is gone', () => {
    const page = createPage();
    setTestInput(page.transactionId, '00000000-0000-4000-8000-000000000999');
    loadBudget();
    TestBed.flushEffects();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(openEditAllocatedTransactionDialog).not.toHaveBeenCalled();
  });

  // PUL-329 QA fix — the dialog now owns submission (it awaits the store
  // mutation itself and closes only on success; see
  // edit-transaction-dialog.spec.ts for that proof). The deep-link caller's
  // own contract is narrower: hand the dialog a submit closure that reaches
  // this transaction, and toast success only once the dialog resolves with a
  // value (i.e. it actually closed).
  it('persists the edit through the submit closure handed to the dialog', async () => {
    const update = { amount: 42 };
    updateTransaction.mockResolvedValue(null);
    openEditAllocatedTransactionDialog.mockImplementation(
      async (
        _tx: unknown,
        _period: unknown,
        submit: (u: unknown) => Promise<string | null>,
      ) => {
        await submit(update);
        return update;
      },
    );

    const page = createPage();
    setTestInput(page.transactionId, TRANSACTION_ID);
    loadBudget();
    TestBed.flushEffects();
    await Promise.resolve();
    await Promise.resolve();

    expect(updateTransaction).toHaveBeenCalledWith(TRANSACTION_ID, update);
    expect(TestBed.inject(MatSnackBar).open).toHaveBeenCalledWith(
      'Modification enregistrée',
      expect.anything(),
      expect.objectContaining({ duration: 5000 }),
    );
  });

  it('shows no toast when the dialog stays open (a refusal never resolves as a close)', async () => {
    const update = { amount: 42 };
    updateTransaction.mockResolvedValue('Solde insuffisant');
    openEditAllocatedTransactionDialog.mockImplementation(
      async (
        _tx: unknown,
        _period: unknown,
        submit: (u: unknown) => Promise<string | null>,
      ) => {
        await submit(update);
        // A refused mutation keeps the dialog open — it never resolves as a close.
        return undefined;
      },
    );

    const page = createPage();
    setTestInput(page.transactionId, TRANSACTION_ID);
    loadBudget();
    TestBed.flushEffects();
    await Promise.resolve();
    await Promise.resolve();

    expect(updateTransaction).toHaveBeenCalledWith(TRANSACTION_ID, update);
    expect(TestBed.inject(MatSnackBar).open).not.toHaveBeenCalled();
  });
});
