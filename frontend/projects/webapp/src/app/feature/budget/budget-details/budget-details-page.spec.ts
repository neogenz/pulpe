import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  input,
  output,
  signal,
  provideZonelessChangeDetection,
} from '@angular/core';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import type { ReconcileAccountsDialogData } from '@pattern/reconcile-accounts/reconcile-accounts-dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import {
  formatBudgetPeriod,
  type BudgetDeletionImpact,
  type SupportedLocale,
} from 'pulpe-shared';
import { BreadcrumbState } from '@core/shell/breadcrumb-state';
import { UserSettingsStore } from '@core/user-settings';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { BaseLoading } from '@ui/loading';
import { BudgetFinancialOverview } from '@ui/budget-financial-overview/budget-financial-overview';
import BudgetDetailsPage from './budget-details-page';
import { BudgetDetailsStore } from './store/budget-details-store';
import { BudgetDetailsDialogService } from './budget-details-dialog.service';
import { BudgetItemsContainer } from './components/budget-items-container';
import { createMockBudget } from '../../../testing/mock-factories';

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

describe('BudgetDetailsPage — localized budget period', () => {
  it.each<SupportedLocale>(['en', 'de', 'it'])(
    'formats the period with the %s interface locale',
    (locale) => {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          {
            provide: BudgetDetailsStore,
            useValue: {
              budgetDetails: signal({ month: 3, year: 2026 }),
              financialTotals: signal(null),
              isStale: signal(false),
              setBudgetId: () => undefined,
            },
          },
          {
            provide: UserSettingsStore,
            useValue: {
              currency: signal('CHF'),
              locale: signal(locale),
              payDayOfMonth: signal(5),
            },
          },
          { provide: Router, useValue: { navigate: () => undefined } },
          {
            provide: BreadcrumbState,
            useValue: {
              setDynamicBreadcrumb: () => undefined,
              clearDynamicBreadcrumb: () => undefined,
            },
          },
          {
            provide: LoadingIndicator,
            useValue: { setLoading: () => undefined },
          },
          { provide: BudgetDetailsDialogService, useValue: {} },
          { provide: MatSnackBar, useValue: {} },
          { provide: TranslocoService, useValue: {} },
        ],
      });

      const component = TestBed.runInInjectionContext(
        () => new BudgetDetailsPage(),
      );

      expect(component['periodDisplay']()).toBe(
        formatBudgetPeriod(3, 2026, 5, locale),
      );
      expect(component['periodDisplay']()).not.toBe(
        formatBudgetPeriod(3, 2026, 5, 'fr'),
      );
    },
  );
});

/**
 * PUL-361 — "Supprimer ce mois". The page is rendered for real (its template is
 * what hides the menu on live and past months); the store, the dialog service
 * and the heavy children are doubles.
 */
@Component({
  selector: 'pulpe-budget-items',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BudgetItemsStub {}

@Component({
  selector: 'pulpe-budget-financial-overview',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BudgetFinancialOverviewStub {
  readonly totals = input<unknown>();
  readonly rollover = input<number>();
  readonly currency = input<string>();
  readonly locale = input<string>();
  readonly showSavingsAction = input<boolean>();
  readonly coverWithSavings = output<void>();
}

@Component({
  selector: 'pulpe-base-loading',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BaseLoadingStub {
  readonly message = input<string>();
  readonly size = input<string>();
  readonly fullHeight = input<boolean>();
  readonly testId = input<string>();
}

describe('BudgetDetailsPage — delete a future month (PUL-361)', () => {
  const NO_LINKS_IMPACT: BudgetDeletionImpact = {
    forecastCount: 4,
    movementCount: 2,
    links: {
      spreadForecasts: 0,
      savingsGoalForecasts: 0,
      savingsWithdrawalForecasts: 0,
      savingsWithdrawalMovements: 0,
    },
  };
  const LINKED_IMPACT: BudgetDeletionImpact = {
    ...NO_LINKS_IMPACT,
    links: { ...NO_LINKS_IMPACT.links, spreadForecasts: 3 },
  };

  let fixture: ComponentFixture<BudgetDetailsPage>;
  let isViewedMonthFuture: ReturnType<typeof signal<boolean>>;
  let store: {
    deletionImpact: ReturnType<typeof vi.fn>;
    deleteMonth: ReturnType<typeof vi.fn>;
    createAllocatedTransaction: ReturnType<typeof vi.fn>;
  };
  let dialogService: { confirmDelete: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  const settle = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve));

  const query = (testId: string): HTMLElement | null =>
    document.querySelector(`[data-testid="${testId}"]`);

  const setup = async (month = 11, budgetId = 'budget-1'): Promise<void> => {
    isViewedMonthFuture = signal(true);
    store = {
      createAllocatedTransaction: vi.fn().mockResolvedValue(null),
      deletionImpact: vi.fn().mockResolvedValue(NO_LINKS_IMPACT),
      // The real store hands the page over to `leave` before it reports success.
      deleteMonth: vi.fn(
        async (
          _id: string,
          _confirmLinks: boolean,
          leave: () => Promise<unknown>,
        ) => {
          await leave();
          return true;
        },
      ),
    };
    dialogService = { confirmDelete: vi.fn().mockResolvedValue(true) };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    snackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: Router, useValue: router },
        { provide: MatSnackBar, useValue: snackBar },
        {
          provide: UserSettingsStore,
          useValue: {
            currency: signal('CHF'),
            locale: signal('fr'),
            payDayOfMonth: signal(1),
          },
        },
        {
          provide: BreadcrumbState,
          useValue: {
            setDynamicBreadcrumb: () => undefined,
            clearDynamicBreadcrumb: () => undefined,
          },
        },
        {
          provide: LoadingIndicator,
          useValue: { setLoading: () => undefined },
        },
      ],
    })
      .overrideComponent(BudgetDetailsPage, {
        set: {
          providers: [
            {
              provide: BudgetDetailsStore,
              useValue: {
                ...store,
                isInitialLoading: signal(false),
                error: signal(undefined),
                isStale: signal(false),
                budgetDetails: signal({
                  ...createMockBudget({
                    id: budgetId,
                    month,
                    year: 2026,
                  }),
                  budgetLines: [],
                  transactions: [],
                }),
                financialTotals: signal(null),
                realizedIncome: signal(100),
                realizedExpenses: signal(40),
                realizedBalance: signal(60),
                previousMonthRollover: signal(-20),
                shouldShowSavingsWithdrawalAction: signal(false),
                hasPrevious: signal(false),
                hasNext: signal(false),
                previousBudgetId: signal(null),
                nextBudgetId: signal(null),
                isViewedMonthFuture,
                setBudgetId: () => undefined,
              },
            },
            { provide: BudgetDetailsDialogService, useValue: dialogService },
          ],
        },
      })
      .overrideComponent(BudgetDetailsPage, {
        remove: {
          imports: [BudgetItemsContainer, BudgetFinancialOverview, BaseLoading],
        },
        add: {
          imports: [
            BudgetItemsStub,
            BudgetFinancialOverviewStub,
            BaseLoadingStub,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(BudgetDetailsPage);
    fixture.componentRef.setInput('id', budgetId);
    await fixture.whenStable();
  };

  it.each([1, 10, 12])(
    'reconciles month %s and refuses writes after navigation',
    async (month) => {
      TestBed.resetTestingModule();
      const budgetId = '11111111-1111-4111-8111-111111111111';
      await setup(month, budgetId);
      let data!: ReconcileAccountsDialogData;
      vi.spyOn(TestBed.inject(MatDialog), 'open').mockImplementation(
        (_component, config) => {
          data = config!.data as ReconcileAccountsDialogData;
          return {} as never;
        },
      );
      query('budget-reconcile-button')!.click();
      expect(data.realized()).toEqual({
        balance: 40,
        checkedIncome: 100,
        checkedOutflows: 40,
        rollover: -20,
      });
      const adjustment = { name: 'Écart', amount: 10, kind: 'income' as const };
      store.createAllocatedTransaction.mockResolvedValueOnce('Réessaie');
      expect(await data.recordAdjustment(adjustment)).toBe(false);
      const attemptedId = store.createAllocatedTransaction.mock.calls[0][0].id;
      expect(attemptedId).toEqual(expect.any(String));
      expect(await data.recordAdjustment(adjustment)).toBe(true);
      expect(store.createAllocatedTransaction).toHaveBeenLastCalledWith(
        expect.objectContaining({
          ...adjustment,
          id: attemptedId,
          budgetId,
          checkedAt: expect.any(String),
        }),
      );
      fixture.componentRef.setInput('id', 'another-month');
      expect(data.realized()).toBeNull();
      expect(await data.recordAdjustment(adjustment)).toBe(false);
      expect(store.createAllocatedTransaction).toHaveBeenCalledTimes(2);
    },
  );

  const openMenuAndDelete = async (): Promise<void> => {
    query('budget-month-menu')?.click();
    await fixture.whenStable();
    query('delete-month-button')?.click();
    await settle();
  };

  beforeEach(() => setup());

  describe('menu', () => {
    it('should offer the menu on a future month', () => {
      expect(query('budget-month-menu')).not.toBeNull();
    });

    it('should not offer the menu on a live or past month', async () => {
      isViewedMonthFuture.set(false);
      await fixture.whenStable();

      expect(query('budget-month-menu')).toBeNull();
    });

    it('should list a single delete entry once opened', async () => {
      query('budget-month-menu')?.click();
      await fixture.whenStable();

      expect(query('delete-month-button')?.textContent).toContain(
        'Supprimer ce mois',
      );
    });
  });

  describe('confirm', () => {
    it('should delete without confirming links when the month has none', async () => {
      await openMenuAndDelete();

      expect(dialogService.confirmDelete).toHaveBeenCalledWith({
        title: 'Supprimer novembre 2026 ?',
        message:
          'Ses prévisions (4) et ses mouvements (2) seront supprimés. Cette action est irréversible.',
      });
      expect(store.deletionImpact).toHaveBeenCalledWith('budget-1');
      expect(store.deleteMonth).toHaveBeenCalledWith(
        'budget-1',
        false,
        expect.any(Function),
      );
    });

    it('should land on the budget list and confirm with a snackbar', async () => {
      await openMenuAndDelete();

      expect(router.navigate).toHaveBeenCalledWith(['/', 'budget']);
      expect(snackBar.open).toHaveBeenCalledWith('Mois supprimé', 'Fermer', {
        duration: 3000,
      });
    });

    it('should name the spread link and confirm the links when the month has one', async () => {
      store.deletionImpact.mockResolvedValue(LINKED_IMPACT);

      await openMenuAndDelete();

      const { message } = dialogService.confirmDelete.mock.calls[0][0];
      expect(message).toContain('prévision lissée (3)');
      expect(message).toContain(
        "Ce mois est aussi lié à d'autres mois ou à un objectif d'épargne",
      );
      expect(store.deleteMonth).toHaveBeenCalledWith(
        'budget-1',
        true,
        expect.any(Function),
      );
    });

    it('should list each non-zero link and sum withdrawal forecasts with movements', async () => {
      store.deletionImpact.mockResolvedValue({
        ...NO_LINKS_IMPACT,
        links: {
          spreadForecasts: 0,
          savingsGoalForecasts: 1,
          savingsWithdrawalForecasts: 1,
          savingsWithdrawalMovements: 2,
        },
      });

      await openMenuAndDelete();

      const { message } = dialogService.confirmDelete.mock.calls[0][0];
      expect(message).toContain(
        "objectif d'épargne (1), retrait d'épargne (3)",
      );
      expect(message).not.toContain('prévision lissée');
    });
  });

  describe('cancel', () => {
    it('should change nothing when the dialog is dismissed', async () => {
      dialogService.confirmDelete.mockResolvedValue(false);

      await openMenuAndDelete();

      expect(store.deleteMonth).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(snackBar.open).not.toHaveBeenCalled();
    });
  });

  describe('refusal', () => {
    it('should show the error and stay put when the impact cannot be read', async () => {
      store.deletionImpact.mockResolvedValue(null);

      await openMenuAndDelete();

      expect(dialogService.confirmDelete).not.toHaveBeenCalled();
      expect(snackBar.open).toHaveBeenCalledWith(
        "Le mois n'a pas pu être supprimé",
        'Fermer',
        expect.anything(),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should show the error and stay put when the server refuses the delete', async () => {
      store.deleteMonth.mockResolvedValue(false);

      await openMenuAndDelete();

      expect(snackBar.open).toHaveBeenCalledTimes(1);
      expect(snackBar.open).toHaveBeenCalledWith(
        "Le mois n'a pas pu être supprimé",
        'Fermer',
        expect.anything(),
      );
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('navigating away mid-deletion', () => {
    const component = (): { deleteMonth: () => Promise<void> } =>
      fixture.componentInstance as unknown as {
        deleteMonth: () => Promise<void>;
      };

    it('should open no dialog when the month changes while the impact loads', async () => {
      let resolveImpact!: (impact: BudgetDeletionImpact) => void;
      store.deletionImpact.mockReturnValue(
        new Promise<BudgetDeletionImpact>((resolve) => {
          resolveImpact = resolve;
        }),
      );

      const deletion = component().deleteMonth();
      fixture.componentRef.setInput('id', 'budget-2');
      await fixture.whenStable();
      resolveImpact(LINKED_IMPACT);
      await deletion;

      expect(store.deletionImpact).toHaveBeenCalledWith('budget-1');
      expect(dialogService.confirmDelete).not.toHaveBeenCalled();
      expect(store.deleteMonth).not.toHaveBeenCalled();
    });

    it('should delete nothing when the month changes while the dialog is open', async () => {
      let confirm!: (confirmed: boolean) => void;
      dialogService.confirmDelete.mockReturnValue(
        new Promise<boolean>((resolve) => {
          confirm = resolve;
        }),
      );

      const deletion = component().deleteMonth();
      await settle();
      fixture.componentRef.setInput('id', 'budget-2');
      await fixture.whenStable();
      confirm(true);
      await deletion;

      expect(store.deleteMonth).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(snackBar.open).not.toHaveBeenCalled();
    });
  });

  describe('double activation', () => {
    it('should run one deletion at a time', async () => {
      let resolveImpact!: (impact: BudgetDeletionImpact) => void;
      store.deletionImpact.mockReturnValue(
        new Promise<BudgetDeletionImpact>((resolve) => {
          resolveImpact = resolve;
        }),
      );
      const component = fixture.componentInstance as unknown as {
        deleteMonth: () => Promise<void>;
      };

      const first = component.deleteMonth();
      const second = component.deleteMonth();
      resolveImpact(NO_LINKS_IMPACT);
      await Promise.all([first, second]);

      expect(store.deletionImpact).toHaveBeenCalledTimes(1);
      expect(store.deleteMonth).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * PUL-329 — arriving from a savings goal's "Retraits" section carries the
 * targeted transaction in a query param. The template stays empty here: the
 * behaviour under test lives entirely in the page's constructor effect.
 */
